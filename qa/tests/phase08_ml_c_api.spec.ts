/**
 * Phase 8 - SCR-34/35 BACKEND ML admin through the real API (QA-08 P15, skill `qa-api-test`), no browser, NO mocks.
 * Flows FL-B08M-11..17 of `QA-08/flows-C6.md` (dataset create field rules, dataset build refusals, training jobs list / read /
 * metrics / logs / create refusals / cancel); one `test()` per flow, one `test.step('[<row id>] ...')` per catalog row of `catalog-C6.md`.
 * Endpoints (BE admin_ml_datasets + admin_ml_training_jobs, all admin only): POST /api/admin/ml/datasets (N29), POST .../datasets/{id}/versions (N31),
 * GET .../training-jobs (N32), POST (N33), GET {id} (N34), POST {id}/cancel (N35), GET {id}/metrics (N36), GET {id}/logs (N37).
 * Role: the admin seed only (S2 #1: no viewer/engineer needed here; FL-B08M-02 covers the 403s). Helpers: `support/p08/P15.ts`.
 *
 * ## Safety: no training run is ever started or cancelled
 * POST /training-jobs is only sent through `guardCreate` (throws before any body that passes validation, unless it names the unknown
 * `dsv_0000...` or a version verified not-ready / other-family); cancel only through `guardCancel` (malformed id, unknown id, or a listed
 * terminal job). Dataset build (POST .../versions) only with refusal bodies; nothing is queued.
 *
 * ## Real-backend budget per run of this file
 * - `POST /api/auth/login`: 7 (one admin per flow) + 7 refresh (support/api.ts); limit 120 / 60 s on the QA stack.
 * - Dataset rows (no delete API, S2 #5): FL-B08M-11 creates 2 (C-001 80-char name, C-007 trimmed), FL-B08M-12 creates 1 (the build target) = 3 / run (unique name suffix per call: a retry adds 3 more; S2 #5 cap 4 holds for retries: 0);
 *   names `${TEST_DATA_PREFIX}b08m-${RUN_ID}-<n>`; coordinator removes them with `qa/tools/cleanup.mjs`.
 * - Training jobs created: 0. Job cancels that take effect: 0. Idempotency-Key: never sent.
 * - Environment premises (listed jobs, a job with metrics / logs, a terminal job) are asserted with `expect.soft(..., 'environment: ...')`, never skipped (S2 #3).
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import { TrainingJobPageSchema } from '../../src/api/schemas/adminMl';
import { adminApi } from './support/p08/admin';
import {
  ML,
  NO_DATASET,
  NO_DATASET_VERSION,
  NO_JOB,
  NO_PROJECT,
  OPENING,
  TERMINAL,
  WALLS,
  asJson,
  call,
  datasetName,
  expectError,
  expectOk,
  guardBuild,
  guardCancel,
  guardCreate,
  itemsOf,
  jobList,
  note,
  projectIds,
  type Json,
} from './support/p08/P15';

const JOBS = `${ML}/training-jobs`;
const DATASETS = `${ML}/datasets`;
const STATUSES = ['queued', 'running', 'cancelling', 'cancelled', 'succeeded', 'failed'] as const;
const NAME_MAX = 80; // BE admin_ml_datasets/schemas.py CleanName
const METRIC_SPLITS = 2; // BE METRIC_SPLITS (train, validation): _whole_steps may add splits - 1 rows past limit (service.py:269-280)
const ENV_JOB = 'environment: at least one training job is listed';
const bare = (id: string): string => id.slice(1, -1); // '[B08M-G-170]' -> 'B08M-G-170' (literal bracketed ids keep coverage-gate greps working)

const withAdmin = async (body: (admin: APIRequestContext) => Promise<void>): Promise<void> => {
  const admin = await adminApi();
  try {
    await body(admin);
  } finally {
    await admin.dispose();
  }
};

/** First listed job whose `kind` stream (metrics -> step, logs -> seq) is non-empty; else the first job. */
async function jobWithStream(admin: APIRequestContext, items: Json[], kind: 'metrics' | 'logs'): Promise<{ id: string; hasRows: boolean } | undefined> {
  for (const job of items.slice(0, 10)) {
    const res = await admin.get(`${JOBS}/${String(job.id)}/${kind}?since=-1&limit=1`);
    if (res.status() === 200 && itemsOf(await res.json(), kind).length > 0) return { id: String(job.id), hasRows: true };
  }
  return items[0] === undefined ? undefined : { id: String(items[0].id), hasRows: false };
}

/** `step`/`seq` cursor behaviour of one stream (G-175/176 metrics, G-185/186 logs). */
async function streamSteps(admin: APIRequestContext, id: string, kind: 'metrics' | 'logs', rowA: string, rowB: string, hasRows: boolean): Promise<void> {
  const key = kind === 'metrics' ? 'step' : 'seq';
  expect.soft(hasRows, `environment: a listed job has ${kind} rows`).toBe(true);
  await test.step(`${rowA} ${kind} since=-1 limit=200 of a real job: ${key} ascending and > since, nextCursor = last ${key}`, async () => {
    const sent = await call(admin, `${bare(rowA)}_${kind}_page`, 'GET', `${JOBS}/${id}/${kind}?since=-1&limit=200`, undefined, [`200, ${key} ascending and > -1; nextCursor = decimal string of the last ${key}`]);
    const body = expectOk(sent, 200, `${kind} page`);
    const keys = (Array.isArray(body.items) ? (body.items as Json[]) : []).map((r) => Number(r[key]));
    expect.soft(keys, `${key} ascending`).toEqual([...keys].sort((a, b) => a - b));
    expect.soft(keys.every((k) => k > -1), `${key} > since`).toBe(true);
    if (body.nextCursor !== undefined) expect.soft(body.nextCursor, 'nextCursor = decimal string of the last key').toBe(keys.length ? String(keys.at(-1)) : '-1');
    else expect.soft(keys.length, 'no nextCursor only past the window').toBeLessThanOrEqual(200 + (kind === 'metrics' ? METRIC_SPLITS - 1 : 0));
  });
  await test.step(`${rowB} ${kind} since=<cursor>: only ${key} > since (exclusive)`, async () => {
    const first = asJson(await (await admin.get(`${JOBS}/${id}/${kind}?since=-1&limit=2`)).json());
    const since = first.nextCursor === undefined ? '-1' : String(first.nextCursor);
    const sent = await call(admin, `${bare(rowB)}_${kind}_since`, 'GET', `${JOBS}/${id}/${kind}?since=${since}&limit=200`, undefined, [`only ${key} > since=${since}`]);
    const rows = itemsOf(expectOk(sent, 200, `${kind} since page`), kind);
    expect.soft(rows.every((r) => Number(r[key]) > Number(since)), `every ${key} > ${since}`).toBe(true);
  });
}

/** Unknown job / since / limit bounds: shared by metrics (FL-14) and logs (FL-15). */
async function streamBounds(admin: APIRequestContext, kind: 'metrics' | 'logs', jobId: string | undefined, ids: { unknown: string; below: string; limit: string; huge: string; abc: string }): Promise<void> {
  await test.step(`${ids.unknown} ${kind} of an unknown job -> 404 trainingJob`, async () => {
    const sent = await call(admin, `${bare(ids.unknown)}_${kind}_unknown`, 'GET', `${JOBS}/${NO_JOB}/${kind}`, undefined, ['404 NOT_FOUND trainingJob; the job is read before any row']);
    expectError(sent, 404, 'NOT_FOUND', { resource: 'trainingJob', hard: true });
  });
  await test.step(`${ids.below} ${kind}?since=-2 -> 422 field since`, async () => {
    const sent = await call(admin, `${bare(ids.below)}_${kind}_since_below`, 'GET', `${JOBS}/${NO_JOB}/${kind}?since=-2`, undefined, ['422 VALIDATION field since (ge -1) before the handler']);
    expectError(sent, 422, 'VALIDATION', { field: 'since' });
  });
  await test.step(`${ids.limit} ${kind}?limit=0 and ?limit=201 -> 422 field limit`, async () => {
    for (const limit of [0, 201]) {
      const sent = await call(admin, `${bare(ids.limit)}_${kind}_limit_${limit}`, 'GET', `${JOBS}/${NO_JOB}/${kind}?limit=${limit}`, undefined, [`limit ${limit} -> 422 VALIDATION field limit (1..200)`]);
      expectError(sent, 422, 'VALIDATION', { field: 'limit' });
    }
  });
  // FLAG (correct behaviour): 200 empty page or 422, never 500 (since has no upper bound; the bind value exceeds the int column).
  await test.step(`${ids.huge} ${kind}?since=9223372036854775808 and 2147483648 -> 200 empty or 422 field since, never 500`, async () => {
    expect.soft(jobId, `${ENV_JOB} (an unknown job would answer 404 before the since is bound)`).toBeDefined();
    if (jobId === undefined) return;
    for (const since of ['9223372036854775808', '2147483648']) {
      const sent = await call(admin, `${bare(ids.huge)}_${kind}_since_${since}`, 'GET', `${JOBS}/${jobId}/${kind}?since=${since}&limit=200`, undefined, [`since=${since} -> 200 empty page or 422 field since; NOT 500`]);
      const status = sent.res.status();
      expect.soft([200, 422], `since=${since}: status ${status} (not 500)`).toContain(status);
      if (status === 200) expect.soft(itemsOf(JSON.parse(sent.text), kind), `since=${since}: empty page`).toEqual([]);
      if (status === 422) expectError(sent, 422, 'VALIDATION', { field: 'since' });
    }
  });
  await test.step(`${ids.abc} ${kind}?since=abc -> 422 field since`, async () => {
    const sent = await call(admin, `${bare(ids.abc)}_${kind}_since_abc`, 'GET', `${JOBS}/${NO_JOB}/${kind}?since=abc`, undefined, ['422 VALIDATION field since']);
    expectError(sent, 422, 'VALIDATION', { field: 'since' });
  });
}

test.describe('A08 phase-8 backend ML admin C (datasets write, training jobs N29-N37)', () => {
  test('SCR-34 · FL-B08M-11 · dataset create: name and family field rules', async () => {
    await withAdmin(async (admin) => {
      const post = (name: string, body: unknown, why: string) => call(admin, name, 'POST', DATASETS, body, [why]);
      const valid = { name: datasetName(9), family: OPENING };
      const rejected = async (id: string, slug: string, body: unknown, field: string, why: string) =>
        expectError(await post(`${id}_${slug}`, body, `422 VALIDATION field "${field}": ${why}`), 422, 'VALIDATION', { field });

      await test.step('[B08M-C-001] name of exactly 80 chars -> 201 stored whole', async () => {
        const name = datasetName(1).padEnd(NAME_MAX, 'x').slice(0, NAME_MAX);
        expect(name).toHaveLength(NAME_MAX);
        const sent = await post('B08M-C-001_name_80', { name, family: OPENING }, '201 the 80-char name stored whole (NAME_MAX 80)');
        const body = expectOk(sent, 201, 'create 80-char name', true);
        expect.soft(body.name, 'name stored whole').toBe(name);
        expect.soft(String(body.id), 'dst_ id').toMatch(/^dst_/u);
      });
      await test.step('[B08M-C-002] name of 81 chars -> 422 field name', async () => {
        await rejected('B08M-C-002', 'name_81', { ...valid, name: valid.name.padEnd(NAME_MAX + 1, 'y') }, 'name', 'over NAME_MAX');
      });
      await test.step('[B08M-C-003] name "" and "   " -> 422 field name', async () => {
        await rejected('B08M-C-003', 'name_empty', { ...valid, name: '' }, 'name', 'empty');
        await rejected('B08M-C-003', 'name_blank', { ...valid, name: '   ' }, 'name', 'strip then min 1');
      });
      await test.step('[B08M-C-004] name with U+0000 / U+0007 -> 422 field name', async () => {
        await rejected('B08M-C-004', 'name_nul', { ...valid, name: `${valid.name}\u0000` }, 'name', 'clean_text rejects Cc');
        await rejected('B08M-C-004', 'name_bel', { ...valid, name: `${valid.name}\u0007` }, 'name', 'clean_text rejects Cc');
      });
      await test.step('[B08M-C-005] name with U+202E (bidi override) -> 422 field name', async () => {
        await rejected('B08M-C-005', 'name_bidi', { ...valid, name: `${valid.name}\u202E` }, 'name', 'bidi override');
      });
      await test.step('[B08M-C-006] name a number 7 / null / missing -> 422 field name', async () => {
        await rejected('B08M-C-006', 'name_number', { ...valid, name: 7 }, 'name', 'not a string');
        await rejected('B08M-C-006', 'name_null', { ...valid, name: null }, 'name', 'null');
        await rejected('B08M-C-006', 'name_missing', { family: OPENING }, 'name', 'missing');
      });
      await test.step('[B08M-C-007] name "  <run>-trim  " -> 201, trimmed in the response and the list', async () => {
        const trimmed = datasetName(2);
        const sent = await post('B08M-C-007_name_trim', { name: `  ${trimmed}  `, family: OPENING }, '201, name trimmed in the response and the list');
        const body = expectOk(sent, 201, 'create padded name');
        expect.soft(body.name, 'response name trimmed').toBe(trimmed);
        const list = await call(admin, 'B08M-C-007_list', 'GET', `${DATASETS}?limit=200&family=${OPENING}`, undefined, ['the list shows the trimmed name']);
        const row = itemsOf(expectOk(list, 200, 'datasets list'), 'datasets').find((d) => d.id === body.id);
        expect.soft(row?.name, 'listed name trimmed').toBe(trimmed);
      });
      await test.step('[B08M-C-008] family doors / null / missing -> 422 field family', async () => {
        await rejected('B08M-C-008', 'family_doors', { name: valid.name, family: 'doors' }, 'family', 'unknown family');
        await rejected('B08M-C-008', 'family_null', { name: valid.name, family: null }, 'family', 'null');
        await rejected('B08M-C-008', 'family_missing', { name: valid.name }, 'family', 'missing');
      });
      await test.step('[B08M-C-009] unknown key createdBy -> 422 field createdBy', async () => {
        await rejected('B08M-C-009', 'unknown_key', { ...valid, createdBy: NO_DATASET }, 'createdBy', 'extra=forbid (C03)');
      });
    });
  });

  test('SCR-34 · FL-B08M-12 · dataset build refusals, nothing started', async () => {
    await withAdmin(async (admin) => {
      const created = await call(admin, 'B08M-G-130_setup_dataset', 'POST', DATASETS, { name: datasetName(3), family: OPENING }, ['setup: the dataset the refusals target']);
      const dataset = String(expectOk(created, 201, 'setup: create the build target', true).id);
      const build = (name: string, id: string, body: Json, why: string) => {
        guardBuild(body);
        return call(admin, name, 'POST', `${DATASETS}/${id}/versions`, body, [why]);
      };
      const versionsOf = async (): Promise<Json[]> => itemsOf(await (await admin.get(`${DATASETS}/${dataset}/versions`)).json(), 'dataset versions');

      await test.step('[B08M-G-130] unknown dataset id dst_0000..., body {} -> 404 dataset', async () => {
        const sent = await build('B08M-G-130_unknown_dataset', NO_DATASET, { projectIds: [NO_PROJECT] }, '404 NOT_FOUND dataset: the dataset is read before projectIds');
        expectError(sent, 404, 'NOT_FOUND', { resource: 'dataset', hard: true });
      });
      await test.step('[B08M-G-131] id garbage -> 404 dataset, not 422', async () => {
        expectError(await build('B08M-G-131_garbage_id', 'garbage', { projectIds: [NO_PROJECT] }, '404 NOT_FOUND dataset, never 422'), 404, 'NOT_FOUND', { resource: 'dataset' });
      });
      await test.step('[B08M-G-132] projectIds [] -> 422 field projectIds, no version row', async () => {
        expectError(await build('B08M-G-132_empty', dataset, { projectIds: [] }, '422 VALIDATION field projectIds (min 1)'), 422, 'VALIDATION', { field: 'projectIds' });
        expect.soft(await versionsOf(), 'no version row').toEqual([]);
      });
      await test.step('[B08M-G-133] malformed id and well-formed unknown prj_0000... -> the same 422 field projectIds', async () => {
        const bad = await build('B08M-G-133_malformed', dataset, { projectIds: ['abc'] }, '422 VALIDATION field projectIds (malformed)');
        const unknown = await build('B08M-G-133_unknown', dataset, { projectIds: [NO_PROJECT] }, '422 VALIDATION field projectIds (unknown, same answer: no probe)');
        const a = expectError(bad, 422, 'VALIDATION', { field: 'projectIds' });
        const b = expectError(unknown, 422, 'VALIDATION', { field: 'projectIds' });
        expect.soft({ code: b.code, field: b.field }, 'same answer for both').toEqual({ code: a.code, field: a.field });
      });
      await test.step('[B08M-G-134] 501 distinct well-formed projectIds -> 422 field projectIds', async () => {
        const ids = projectIds(501);
        expect(new Set(ids).size).toBe(501);
        expectError(await build('B08M-G-134_501', dataset, { projectIds: ids }, '422 VALIDATION field projectIds (max 500 after dedupe)'), 422, 'VALIDATION', { field: 'projectIds' });
      });
      await test.step('[B08M-G-136] unknown key sampleCount -> 422 field sampleCount', async () => {
        expectError(await build('B08M-G-136_unknown_key', dataset, { projectIds: [NO_PROJECT], sampleCount: 1 }, '422 VALIDATION field sampleCount (C03)'), 422, 'VALIDATION', { field: 'sampleCount' });
      });
      await test.step('[B08M-G-137] after all refusals GET versions: items empty', async () => {
        const sent = await call(admin, 'B08M-G-137_versions', 'GET', `${DATASETS}/${dataset}/versions`, undefined, ['items empty: nothing was started']);
        expect.soft(itemsOf(expectOk(sent, 200, 'versions'), 'versions'), 'nothing started').toEqual([]);
      });
    });
  });

  test('SCR-35 · FL-B08M-13 · training jobs list: filters and paging', async () => {
    await withAdmin(async (admin) => {
      const { items: all } = await jobList(admin, 'B08M-G-150_setup');
      const get = (name: string, query: string, why: string) => call(admin, name, 'GET', `${JOBS}?${query}`, undefined, [why]);

      await test.step('[B08M-G-150] default list: newest first, exact key set', async () => {
        const sent = await get('B08M-G-150_default', '', '200 newest first; required keys, optional only when set, no K01/K02 columns');
        const body = expectOk(sent, 200, 'default list', true);
        expect.soft(TrainingJobPageSchema.safeParse(body).success, 'FE TrainingJobPageSchema decodes the page').toBe(true);
        const items = itemsOf(body, 'jobs');
        expect.soft(items.length, ENV_JOB).toBeGreaterThan(0);
        const required = ['baseModel', 'createdAt', 'creatorId', 'datasetVersionId', 'epochs', 'family', 'id', 'status'];
        const optional = ['currentEpoch', 'startedAt', 'endedAt', 'resultModelVersionId', 'failureCode'];
        for (const row of items) {
          for (const k of required) expect.soft(row, `row ${String(row.id)} has ${k}`).toHaveProperty(k);
          for (const k of Object.keys(row)) expect.soft([...required, ...optional], `row ${String(row.id)}: key ${k} allowed`).toContain(k);
          for (const k of ['lastHeartbeatAt', 'artifactsPurgedAt', 'requeueCount', 'updatedAt']) expect.soft(row, `row ${String(row.id)} no ${k}`).not.toHaveProperty(k);
        }
        const times = items.map((r) => Date.parse(String(r.createdAt)));
        expect.soft(times, 'createdAt newest first').toEqual([...times].sort((a, b) => b - a));
      });
      await test.step('[B08M-G-151] ?status=<each of 6> -> 200, every item has that status', async () => {
        for (const status of STATUSES) {
          const sent = await get(`B08M-G-151_${status}`, `status=${status}`, `?status=${status} -> only ${status} rows`);
          const rows = itemsOf(expectOk(sent, 200, `status=${status}`), 'jobs');
          for (const row of rows) expect.soft(row.status, `status=${status} row ${String(row.id)}`).toBe(status);
          // Q14: the seed holds terminal jobs only (succeeded/failed/cancelled, >= 1 each); no job is ever queued, running or cancelling
          if (status === 'queued' || status === 'running' || status === 'cancelling') expect.soft(rows, `status=${status}: empty list (terminal-only seed, Q14)`).toEqual([]);
          else expect.soft(rows.length, `environment: seeded terminal job with status=${status}`).toBeGreaterThan(0);
        }
      });
      await test.step('[B08M-G-152] ?family=wallSegmentation and openingAndFurnitureDetection -> only that family', async () => {
        for (const family of [WALLS, OPENING]) {
          const sent = await get(`B08M-G-152_${family}`, `family=${family}`, `?family=${family} -> only that family`);
          for (const row of itemsOf(expectOk(sent, 200, `family=${family}`), 'jobs')) expect.soft(row.family, `family=${family} row ${String(row.id)}`).toBe(family);
        }
      });
      await test.step('[B08M-G-153] ?family=dimensionReading -> 422 field family', async () => {
        expectError(await get('B08M-G-153_not_trainable', 'family=dimensionReading', '422 VALIDATION field family (not trainable)'), 422, 'VALIDATION', { field: 'family' });
      });
      await test.step('[B08M-G-154] ?status=done -> 422 field status', async () => {
        expectError(await get('B08M-G-154_status_done', 'status=done', '422 VALIDATION field status'), 422, 'VALIDATION', { field: 'status' });
      });
      await test.step('[B08M-G-155] ?limit=0, 201 -> 422 field limit; ?limit=200 -> 200', async () => {
        expectError(await get('B08M-G-155_limit_0', 'limit=0', '422 field limit'), 422, 'VALIDATION', { field: 'limit' });
        expectError(await get('B08M-G-155_limit_201', 'limit=201', '422 field limit'), 422, 'VALIDATION', { field: 'limit' });
        expectOk(await get('B08M-G-155_limit_200', 'limit=200', '200 at the maximum'), 200, 'limit=200');
      });
      await test.step('[B08M-G-156] ?cursor=abc.def -> 422 CURSOR_INVALID', async () => {
        expectError(await get('B08M-G-156_cursor', 'cursor=abc.def', '422 CURSOR_INVALID'), 422, 'CURSOR_INVALID');
      });
      await test.step('[B08M-G-157] limit=1 then cursor strictly after; a succeeded cursor reused with another status -> CURSOR_INVALID', async () => {
        expect.soft(all.length, 'environment: at least 2 training jobs for paging').toBeGreaterThanOrEqual(2);
        const first = expectOk(await get('B08M-G-157_page1', 'limit=1', 'page 1: one item + nextCursor'), 200, 'page 1');
        const cursor = first.nextCursor;
        expect.soft(typeof cursor, 'page 1 has nextCursor').toBe('string');
        if (typeof cursor === 'string') {
          const second = expectOk(await get('B08M-G-157_page2', `limit=1&cursor=${encodeURIComponent(cursor)}`, 'page 2 strictly after page 1'), 200, 'page 2');
          expect.soft(itemsOf(second, 'jobs')[0]?.id, 'page 2 = the 2nd newest, not repeated').toBe(all[1]?.id);
        }
        // Q14: terminal-only seed has >= 1 (not >= 2) succeeded job, so the cursor is issued by the unfiltered page 1 (filters are bound into it, service.py:104)
        if (typeof cursor === 'string') {
          const reuse = await get('B08M-G-157_reuse', `status=failed&limit=1&cursor=${encodeURIComponent(cursor)}`, 'cursor issued with no status reused under status=failed -> 422 CURSOR_INVALID');
          expectError(reuse, 422, 'CURSOR_INVALID');
        }
      });
    });
  });

  test('SCR-35 · FL-B08M-14 · training job read, 404s and metrics query bounds', async () => {
    await withAdmin(async (admin) => {
      const { items } = await jobList(admin, 'B08M-G-160_setup');
      const stream = await jobWithStream(admin, items, 'metrics');

      await test.step('[B08M-G-160] unknown job and garbage -> 404 trainingJob, never 422', async () => {
        for (const [slug, id] of [['unknown', NO_JOB], ['garbage', 'garbage']] as const) {
          const sent = await call(admin, `B08M-G-160_${slug}`, 'GET', `${JOBS}/${id}`, undefined, ['404 NOT_FOUND trainingJob']);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'trainingJob', hard: true });
        }
      });
      // FLAG (correct behaviour): a NUL in the id must be 404, never 500.
      await test.step('[B08M-G-161] %00 in the id on job, metrics, logs, cancel -> proxy 400 (nginx, before the API), never 500', async () => {
        // Q12-Q14 decision: nginx answers 400 text/html for %00 in the URL path (evidence A08_B08M-G-161_*_nul.json); NUL stays covered in the body (G-054) and by pytest
        const id = 'job_%00x';
        guardCancel(id);
        for (const [slug, method, suffix, body] of [['job', 'GET', '', undefined], ['metrics', 'GET', '/metrics', undefined], ['logs', 'GET', '/logs', undefined], ['cancel', 'POST', '/cancel', {}]] as const) {
          const sent = await call(admin, `B08M-G-161_${slug}`, method, `${JOBS}/${id}${suffix}`, body, [`${method} ${suffix || 'job'} with %00 -> proxy 400 text/html; NOT 500`]);
          expect.soft(sent.res.status(), `${slug}: proxy 400, not 500`).toBe(400);
          expect.soft(sent.res.headers()['content-type'], `${slug}: nginx html page`).toContain('text/html');
        }
      });
      await test.step('[B08M-G-162] GET job of a listed row -> 200 body equals its list row', async () => {
        const row = items.find((j) => (TERMINAL as readonly string[]).includes(String(j.status)));
        expect.soft(row, `${ENV_JOB} (a terminal one: queued/running rows change between list and read)`).toBeDefined();
        if (row === undefined) return;
        const sent = await call(admin, 'B08M-G-162_job', 'GET', `${JOBS}/${String(row.id)}`, undefined, ['200 body deep-equals its list row']);
        expect.soft(expectOk(sent, 200, 'job read'), 'equals the list row').toEqual(row);
      });
      await streamBounds(admin, 'metrics', stream?.id, { unknown: '[B08M-G-170]', below: '[B08M-G-171]', limit: '[B08M-G-172]', huge: '[B08M-G-173]', abc: '[B08M-G-174]' });
      if (stream === undefined) {
        for (const id of ['B08M-G-175', 'B08M-G-176']) {
          await test.step(`[${id}] metrics of a real job`, async () => {
            expect.soft(stream, ENV_JOB).toBeDefined();
          });
        }
      } else await streamSteps(admin, stream.id, 'metrics', '[B08M-G-175]', '[B08M-G-176]', stream.hasRows);
    });
  });

  test('SCR-35 · FL-B08M-15 · training job logs query bounds and cursor', async () => {
    await withAdmin(async (admin) => {
      const { items } = await jobList(admin, 'B08M-G-180_setup');
      const stream = await jobWithStream(admin, items, 'logs');
      await streamBounds(admin, 'logs', stream?.id, { unknown: '[B08M-G-180]', below: '[B08M-G-181]', limit: '[B08M-G-182]', huge: '[B08M-G-183]', abc: '[B08M-G-184]' });
      if (stream === undefined) {
        for (const id of ['B08M-G-185', 'B08M-G-186']) {
          await test.step(`[${id}] logs of a real job`, async () => {
            expect.soft(stream, ENV_JOB).toBeDefined();
          });
        }
      } else await streamSteps(admin, stream.id, 'logs', '[B08M-G-185]', '[B08M-G-186]', stream.hasRows);
    });
  });

  test('SCR-35 · FL-B08M-16 · training job create refusals, no job created', async () => {
    await withAdmin(async (admin) => {
      const newest = async (name: string): Promise<unknown> => itemsOf((await jobList(admin, name, 'limit=1')).sent.body, 'jobs')[0]?.id;
      const before = await newest('B08M-G-200_before');
      const valid: Json = { family: OPENING, datasetVersionId: NO_DATASET_VERSION, baseModel: 'yolov8n', epochs: 1 };
      const refusable = new Set<string>();
      const post = async (name: string, body: Json, why: string) => {
        guardCreate(body, refusable);
        return call(admin, name, 'POST', JOBS, body, [why, 'no Idempotency-Key']);
      };
      const bad = async (id: string, slug: string, body: Json, field: string, hard = false) =>
        expectError(await post(`${id}_${slug}`, body, `422 VALIDATION field "${field}"`), 422, 'VALIDATION', { field, hard });

      await test.step('[B08M-G-200] epochs 0 and 301 -> 422 field epochs', async () => {
        await bad('B08M-G-200', 'epochs_0', { ...valid, epochs: 0 }, 'epochs', true);
        await bad('B08M-G-200', 'epochs_301', { ...valid, epochs: 301 }, 'epochs', true);
      });
      // FLAG (correct behaviour): the wire is strict; a lax int would turn `true` into 1. Bodies carry the unknown dsv, so a lax pass answers 404, never creates.
      await test.step('[B08M-G-201] epochs 1.5, true, "3", null -> 422 field epochs each', async () => {
        for (const [slug, epochs] of [['float', 1.5], ['bool', true], ['string', '3'], ['null', null]] as const) await bad('B08M-G-201', slug, { ...valid, epochs }, 'epochs');
      });
      await test.step('[B08M-G-202] family dimensionReading / doors / missing -> 422 field family', async () => {
        const { family: _family, ...noFamily } = valid;
        await bad('B08M-G-202', 'not_trainable', { ...valid, family: 'dimensionReading' }, 'family');
        await bad('B08M-G-202', 'doors', { ...valid, family: 'doors' }, 'family');
        await bad('B08M-G-202', 'missing', noFamily, 'family');
      });
      await test.step('[B08M-G-203] datasetVersionId dsv_bad / number / missing -> 422 field datasetVersionId, not 404', async () => {
        const { datasetVersionId: _dsv, ...noDsv } = valid;
        await bad('B08M-G-203', 'dsv_bad', { ...valid, datasetVersionId: 'dsv_bad' }, 'datasetVersionId');
        await bad('B08M-G-203', 'number', { ...valid, datasetVersionId: 5 }, 'datasetVersionId');
        await bad('B08M-G-203', 'missing', noDsv, 'datasetVersionId');
      });
      await test.step('[B08M-G-204] baseModel missing / number -> 422 field baseModel', async () => {
        const { baseModel: _base, ...noBase } = valid;
        await bad('B08M-G-204', 'missing', noBase, 'baseModel');
        await bad('B08M-G-204', 'number', { ...valid, baseModel: 5 }, 'baseModel');
      });
      await test.step('[B08M-G-205] unknown key creatorId -> 422 field creatorId', async () => {
        await bad('B08M-G-205', 'creator', { ...valid, creatorId: NO_DATASET }, 'creatorId');
      });
      await test.step('[B08M-G-206] opening family with baseModel mitB0 -> 422 TRAINING_BASE_MODEL_MISMATCH', async () => {
        expectError(await post('B08M-G-206_mismatch', { ...valid, baseModel: 'mitB0' }, '422 TRAINING_BASE_MODEL_MISMATCH, decided before the dataset lookup'), 422, 'TRAINING_BASE_MODEL_MISMATCH');
      });
      await test.step('[B08M-G-207] well-formed unknown dsv_0000... -> 404 datasetVersion', async () => {
        expectError(await post('B08M-G-207_unknown_dsv', valid, '404 NOT_FOUND datasetVersion'), 404, 'NOT_FOUND', { resource: 'datasetVersion' });
      });
      // Real dataset versions: only used when the BE must refuse before the insert; each id is verified (status / family) before it is allowed through the guard.
      const datasets = itemsOf((await call(admin, 'B08M-G-208_datasets', 'GET', `${DATASETS}?limit=200`, undefined, ['setup: datasets for the 422 branches'])).body, 'datasets');
      const versions: { dataset: Json; version: Json }[] = [];
      for (const dataset of datasets) {
        if (versions.some((v) => v.version.status === 'ready') && versions.some((v) => v.version.status === 'building' || v.version.status === 'failed')) break;
        const res = await admin.get(`${DATASETS}/${String(dataset.id)}/versions?limit=200`);
        if (res.status() === 200) for (const version of itemsOf(await res.json(), 'dataset versions')) versions.push({ dataset, version });
      }
      const other = (family: unknown): { family: string; baseModel: string } => (family === WALLS ? { family: OPENING, baseModel: 'yolov8n' } : { family: WALLS, baseModel: 'mitB0' });
      await test.step('[B08M-G-208] dataset version building/failed -> 422 DATASET_VERSION_NOT_READY', async () => {
        const hit = versions.find((v) => v.version.status === 'building' || v.version.status === 'failed');
        expect.soft(hit, 'environment: a building or failed dataset version exists').toBeDefined();
        if (hit === undefined) return;
        refusable.add(String(hit.version.id));
        const body = { ...other(hit.dataset.family), datasetVersionId: hit.version.id, epochs: 1 };
        expectError(await post('B08M-G-208_not_ready', body, `dataset version ${String(hit.version.status)} -> 422 DATASET_VERSION_NOT_READY`), 422, 'DATASET_VERSION_NOT_READY');
      });
      await test.step('[B08M-G-209] ready version of another family -> 422 DATASET_FAMILY_MISMATCH', async () => {
        const hit = versions.find((v) => v.version.status === 'ready');
        expect.soft(hit, 'environment: a ready dataset version exists').toBeDefined();
        if (hit === undefined) return;
        const target = other(hit.dataset.family);
        expect(target.family, 'the body family differs from the dataset family').not.toBe(hit.dataset.family);
        refusable.add(String(hit.version.id));
        const body = { ...target, datasetVersionId: hit.version.id, epochs: 1 };
        expectError(await post('B08M-G-209_family_mismatch', body, 'ready version of a dataset of another family -> 422 DATASET_FAMILY_MISMATCH'), 422, 'DATASET_FAMILY_MISMATCH');
      });
      await test.step('[B08M-G-210] after the refusals the newest job id is unchanged', async () => {
        expect.soft(await newest('B08M-G-210_after'), 'nothing was created').toBe(before);
        note(`jobs created by this flow: 0 (newest before = ${String(before)})`);
      });
    });
  });

  test('SCR-35 · FL-B08M-17 · training job cancel: 404, 422, 409, no-effect', async () => {
    await withAdmin(async (admin) => {
      const { items } = await jobList(admin, 'B08M-G-220_setup');
      const safe = new Set(items.filter((j) => (TERMINAL as readonly string[]).includes(String(j.status))).map((j) => String(j.id)));
      const cancel = (name: string, id: string, body: Json, why: string) => {
        guardCancel(id, safe);
        return call(admin, name, 'POST', `${JOBS}/${id}/cancel`, body, [why]);
      };
      const reread = async (id: string): Promise<unknown> => (await admin.get(`${JOBS}/${id}`)).json();

      await test.step('[B08M-G-220] cancel unknown job_0000..., body {} -> 404 trainingJob', async () => {
        expectError(await cancel('B08M-G-220_unknown', NO_JOB, {}, '404 NOT_FOUND trainingJob'), 404, 'NOT_FOUND', { resource: 'trainingJob', hard: true });
      });
      await test.step('[B08M-G-221] cancel with unknown key force:true -> 422 field force', async () => {
        expectError(await cancel('B08M-G-221_force', NO_JOB, { force: true }, '422 VALIDATION field force (extra=forbid), before the 404 lookup'), 422, 'VALIDATION', { field: 'force' });
      });
      await test.step('[B08M-G-222] cancel a listed succeeded/failed job -> 409 TRAINING_JOB_NOT_CANCELLABLE, row unchanged', async () => {
        const job = items.find((j) => j.status === 'succeeded' || j.status === 'failed');
        expect.soft(job, 'environment: a succeeded or failed training job is listed').toBeDefined();
        if (job === undefined) return;
        const sent = await cancel('B08M-G-222_terminal', String(job.id), {}, `409 TRAINING_JOB_NOT_CANCELLABLE for a ${String(job.status)} job`);
        expectError(sent, 409, 'TRAINING_JOB_NOT_CANCELLABLE');
        expect.soft(await reread(String(job.id)), 'job row unchanged on re-read').toEqual(job);
      });
      await test.step('[B08M-G-223] cancel a listed cancelling/cancelled job -> 200 same row, no effect', async () => {
        const job = items.find((j) => j.status === 'cancelled') ?? items.find((j) => j.status === 'cancelling');
        expect.soft(job, 'environment: a cancelling or cancelled training job is listed').toBeDefined();
        if (job === undefined) return;
        const sent = await cancel('B08M-G-223_noop', String(job.id), {}, `200 the same ${String(job.status)} row, no effect`);
        const after = expectOk(sent, 200, 'cancel of a cancel-state job');
        if (job.status === 'cancelled') {
          expect.soft(after, 'same row').toEqual(job);
          expect.soft(await reread(String(job.id)), 'job row unchanged on re-read').toEqual(job);
        } else {
          expect.soft([after.id, ['cancelling', 'cancelled'].includes(String(after.status))], 'same job, still cancelling or already cancelled').toEqual([job.id, true]);
        }
      });
    });
  });
});
