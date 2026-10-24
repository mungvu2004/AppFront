/**
 * Phase 12 — IT-ML API layer: integration of the trained walls (SegFormer-B2) and objects (yolo11m) models on the f14
 * stack, no browser, no mocks. Plan + case list: `F:/App/docs/it-ml/IT-PLAN.md` (ids IT-ML-NNN, file
 * `qa/coverage/phase12.ids`). UI half: `phase12_itml_ui.spec.ts`.
 *
 * ## What IT checks (and what it does not)
 * The seams: upload → Celery pipeline → ML tasks → spatial layer → registry pins. Model QUALITY (IoU / mAP) is eval's
 * job; counts are only checked against reviewed RANGES in `support/p12/golden/golden.json` (null = not reviewed yet →
 * IT-ML-016 fails with that sentence, by design).
 *
 * ## Read-only towards shared state
 * Own `qa-<runId>-itml-…` projects, deleted in `finally`. No `PUT …/spatial/layer`, no N24 activation, no N26 upload.
 * Docker reads only (`printenv`, `grep`, `stats`, `psql select`).
 *
 * ## Serial on purpose
 * The ml worker runs `--concurrency 1` (AppBack deploy/compose/base.yml:191-196): parallel tests would only queue and
 * blur the timings. G0 first: if the stack is on fake ML or the ml image is stale, everything after it is skipped.
 *
 * ## Budget (f14 qa-limits.override.yml)
 * Admin logins: 1 per test (13). `drawings_init` (admin, 300 / 600 s on f14): G0 1 + G1-G5 5 + D 6 + F 3 = 15.
 * Real ML runs: 14 (G0 smoke, G1-G5, N1, N2, D-056 x2, F-070 x2, F-072) — ~15-25 min on CPU.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { captureExchange } from './support/api';
import { deleteSeededProject } from './support/drawingSeed';
import { TEST_DATA_PREFIX } from './support/evidence';
import { envDrawingPng } from './support/phase03Seed';
import { SseConn, streamCookieOf, streamPath } from './support/p03/P12';
import {
  ACTIVE,
  FAMILY,
  ML_CONTAINER,
  REAL_ML_MIN_MS,
  RUN_TIMEOUT_MS,
  SLOW_PAGE_MS,
  STEP_ORDER,
  adminApi,
  blankPng,
  clearG0,
  countsOf,
  docker,
  duplicates,
  fragmentReport,
  furnitureOutside,
  g0Passed,
  golden,
  goldenPng,
  inRange,
  invalidGeometry,
  longWindows,
  LONG_WINDOW_FACTOR,
  markG0Passed,
  modelsUsed,
  openingsOffWall,
  readLayer,
  runOf,
  saveJson,
  uploadAndTrace,
  type RunTrace,
} from './support/p12/itml';

type Json = Record<string, unknown>;

let api: APIRequestContext;
const projects: string[] = [];

test.beforeEach(async ({}, testInfo) => {
  if (!testInfo.title.startsWith('G0')) test.skip(!g0Passed(), 'G0 has not passed within 2 h: run --grep "G0" first');
  api = await adminApi();
});

test.afterEach(async () => {
  if (!api) return; // login itself failed: nothing was created
  for (const id of projects.splice(0)) {
    const problem = await deleteSeededProject(api, id);
    if (problem) test.info().annotations.push({ type: 'cleanup', description: problem });
  }
  await api.dispose();
});

/** Upload + trace, the project queued for deletion. */
async function run(slug: string, png: Buffer, opts: Parameters<typeof uploadAndTrace>[3] = {}): Promise<RunTrace> {
  const trace = await uploadAndTrace(api, slug, png, opts);
  projects.push(trace.projectId);
  return trace;
}

/* ================================================================================================= */
/* G0 — the stack runs the real models (stop everything else when not)                              */
/* ================================================================================================= */

test('G0 f14 runs the real, current models', async () => {
  test.setTimeout(RUN_TIMEOUT_MS + 60_000);
  clearG0();

  await test.step('[IT-ML-001] GET /api/ready → 200', async () => {
    const res = await api.get('/api/ready');
    await captureExchange('IT-ML-001_ready.json', { method: 'GET', path: '/api/ready' }, res, ['200: api, db, broker ready']);
    expect(res.status()).toBe(200);
  });

  await test.step('[IT-ML-002] ml container: ML_BACKEND = onnx (not fake)', async () => {
    const backend = docker(['exec', ML_CONTAINER, 'printenv', 'ML_BACKEND']);
    await saveJson('IT-ML-002_ml_backend', { container: ML_CONTAINER, ML_BACKEND: backend });
    expect(backend, 'chuoi.sh exports ML_BACKEND=fake: do not run its up/seed phases').toBe('onnx');
  });

  await test.step('[IT-ML-003] registry: walls + objects active = the plan versions, onnx, evaluation completed', async () => {
    const res = await api.get('/api/admin/ml/model-families');
    const body = (await captureExchange('IT-ML-003_families.json', { method: 'GET', path: '/api/admin/ml/model-families' }, res, [
      `${FAMILY.walls} active = ${ACTIVE.walls}`,
      `${FAMILY.objects} active = ${ACTIVE.objects}`,
    ])) as { items: Json[] };
    expect(res.status()).toBe(200);
    const active = Object.fromEntries(body.items.map((f) => [String(f.family), f.activeVersionId]));
    expect(active[FAMILY.walls]).toBe(ACTIVE.walls);
    expect(active[FAMILY.objects]).toBe(ACTIVE.objects);
    for (const id of [ACTIVE.walls, ACTIVE.objects]) {
      const v = await api.get(`/api/admin/ml/model-versions/${id}`);
      expect(v.status(), `N27 ${id}`).toBe(200);
      const version = (await v.json()) as Json;
      expect.soft(version.weightsFormat, `${id} weightsFormat`).toBe('onnx');
      expect.soft(version.evaluationStatus, `${id} evaluationStatus`).toBe('completed');
    }
  });

  await test.step('[IT-ML-004] ml image carries main: NOT_A_FLOOR_PLAN gate + cut-fragment rule present', async () => {
    const gate = docker(['exec', ML_CONTAINER, 'grep', '-c', 'NOT_A_FLOOR_PLAN', '/app/apps/ml/walls/step.py']);
    const cut = docker(['exec', ML_CONTAINER, 'grep', '-c', '_drop_cut_fragments', '/app/apps/ml/objects/detector.py']);
    await saveJson('IT-ML-004_ml_image', { notAFloorPlanLines: gate, dropCutFragmentsLines: cut });
    expect(Number(gate), 'ml image older than c53dadb8: rebuild deploy/docker/ml.Dockerfile').toBeGreaterThan(0);
    expect(Number(cut), 'ml image older than 6301ef67: rebuild deploy/docker/ml.Dockerfile').toBeGreaterThan(0);
  });

  await test.step(`[IT-ML-005] smoke drawing.png completes and takes > ${String(REAL_ML_MIN_MS)} ms (fake ML takes ~1 s)`, async () => {
    const trace = await run('g0-smoke', envDrawingPng());
    await saveJson('IT-ML-005_smoke_trace', trace);
    expect(trace.status, `smoke run ${trace.error}`).toBe('completed');
    expect(trace.ms).toBeGreaterThan(REAL_ML_MIN_MS);
  });

  if (test.info().errors.length === 0) markG0Passed(); // soft failures in IT-ML-003 keep the gate closed too
});

/* ================================================================================================= */
/* A — main flow per golden drawing                                                                  */
/* ================================================================================================= */

for (const name of ['G1-small', 'G2-medium', 'G3-large', 'G4-rooms', 'G5-windows'] as const) {
  test(`A ${name}: upload → pipeline → layer`, async () => {
    test.setTimeout(RUN_TIMEOUT_MS + 120_000);
    const sample = golden().samples[name];
    if (!sample) throw new Error(`golden.json has no ${name}`);

    let sse: SseConn | undefined;
    // SSE only for the first drawing: one stream is enough to prove S1 carries the same outcome as #8.
    const trace = await run(
      name.toLowerCase(),
      goldenPng(name),
      name === 'G1-small'
        ? {
            onUploaded: async ({ projectId, uploadId }) => {
              sse = await SseConn.open(streamPath(projectId, uploadId), { cookie: await streamCookieOf(api) });
            },
          }
        : {},
    );

    await test.step(`[IT-ML-010] ${name}: #5 → #6 → #7 accepted, run started`, async () => {
      await saveJson(`IT-ML-010_${name}_trace`, trace);
      expect(trace.uploadId).toMatch(/^upl_/u);
      expect(trace.steps.length, 'at least one progress step seen').toBeGreaterThan(0);
    });

    await test.step(`[IT-ML-011] ${name}: steps in pipeline order, percent never drops, ends completed 100`, async () => {
      expect(trace.status, `run failed: ${trace.error}`).toBe('completed');
      const order = trace.steps.map((s) => STEP_ORDER.indexOf(s as (typeof STEP_ORDER)[number]));
      expect(order.every((i) => i >= 0), `unknown step in ${trace.steps.join(',')}`).toBe(true);
      expect(order, 'steps go forward only').toEqual([...order].sort((a, b) => a - b));
      const drops = trace.percents.filter((p, i) => i > 0 && p < (trace.percents[i - 1] ?? 0));
      expect(drops, 'progressPercent decreased').toEqual([]);
      expect(trace.percents.at(-1)).toBe(100);
      if (trace.ms > SLOW_PAGE_MS) test.info().annotations.push({ type: 'slow', description: `${name} ${String(trace.ms)} ms > ${String(SLOW_PAGE_MS)}` });
    });

    if (name === 'G1-small') {
      await test.step('[IT-ML-012] G1-small: SSE stream reports the same final status as #8', async () => {
        const conn = sse;
        if (!conn) throw new Error('SSE was not opened');
        const done = await conn.until((c) => c.frames.some((f) => f.data.status === 'completed' || f.data.status === 'failed'), 30_000);
        await conn.close();
        await saveJson('IT-ML-012_G1_sse', conn.record());
        expect(done, 'no final SSE frame within 30 s after #8 was final').toBe(true);
        expect(conn.frames.at(-1)?.data.status).toBe(trace.status);
      });
    }

    const runRow = await runOf(api, trace.projectId, trace.uploadId);
    await test.step(`[IT-ML-013] ${name}: N7b lists the run completed, no errorCode`, async () => {
      await saveJson(`IT-ML-013_${name}_run`, runRow);
      expect(runRow.status).toBe('completed');
      expect(runRow.errorCode).toBeUndefined();
    });

    await test.step(`[IT-ML-014] ${name}: pipeline_run_models.used = the active walls + objects versions`, async () => {
      const used = modelsUsed(String(runRow.runId));
      await saveJson(`IT-ML-014_${name}_used`, { runId: runRow.runId, used });
      expect(used[FAMILY.walls]).toBe(ACTIVE.walls);
      expect(used[FAMILY.objects]).toBe(ACTIVE.objects);
    });

    const doc = await readLayer(api, trace.projectId, trace.floorId);
    const counts = countsOf(doc);
    await test.step(`[IT-ML-015] ${name}: N16 layer parses with the FE wire schema, revision ≥ 1, walls present`, async () => {
      const windowWidths = doc.layer.openings.filter((o) => o.kind === 'window').map((o) => o.widthMm);
      await saveJson(`IT-ML-015_${name}_counts`, {
        revision: doc.revision,
        scaleStatus: doc.scaleStatus ?? 'calibrated',
        counts,
        maxWindowMm: Math.max(0, ...windowWidths),
      });
      expect(doc.revision).toBeGreaterThanOrEqual(1);
      expect(counts.walls).toBeGreaterThan(0);
    });

    await test.step(`[IT-ML-016] ${name}: counts inside the reviewed golden ranges`, async () => {
      for (const key of ['walls', 'doors', 'windows', 'furniture'] as const) {
        expect.soft(inRange(counts[key], sample.expect[key]), `${name} ${key}`).toBeNull();
      }
    });

    await test.step(`[IT-ML-017] ${name}: geometry valid (finite, walls with length, boxes with area, furniture inside the plan)`, async () => {
      const bad = [...invalidGeometry(doc), ...furnitureOutside(doc)];
      await saveJson(`IT-ML-017_${name}_geometry`, { bad });
      expect(bad).toEqual([]);
    });

    await test.step(`[IT-ML-018] ${name}: every opening sits on an existing wall and fits in it`, async () => {
      const off = openingsOffWall(doc);
      await saveJson(`IT-ML-018_${name}_openings`, { off });
      expect(off).toEqual([]);
    });

    await test.step(`[IT-ML-019] ${name}: N15 graph agrees with N16 (revision, counts on this level)`, async () => {
      const res = await api.get(`/api/projects/${trace.projectId}/spatial`);
      expect(res.status()).toBe(200);
      const graphDoc = (await res.json()) as { floorRevisions: Json[]; graph: Record<string, Json[]> };
      const rev = graphDoc.floorRevisions.find((f) => f.floorId === trace.floorId)?.revision;
      const onLevel = (list: Json[] | undefined): number => (list ?? []).filter((e) => e.levelId === doc.level.id).length;
      const graphCounts = { walls: onLevel(graphDoc.graph.walls), furniture: onLevel(graphDoc.graph.furniture) };
      await saveJson(`IT-ML-019_${name}_graph`, { rev, graphCounts, layer: { revision: doc.revision, walls: counts.walls, furniture: counts.furniture } });
      expect(rev).toBe(doc.revision);
      expect(graphCounts).toEqual({ walls: counts.walls, furniture: counts.furniture });
    });

    if (name === 'G5-windows') {
      await test.step('[IT-ML-060] G5-windows: no duplicate openings / furniture (same kind, overlapping)', async () => {
        const dup = duplicates(doc);
        await saveJson('IT-ML-060_G5_duplicates', { dup });
        expect(dup).toEqual([]);
      });
      await test.step('[IT-ML-061] G5-windows: no window wide enough to be several merged', async () => {
        const long = longWindows(doc);
        await saveJson('IT-ML-061_G5_long_windows', { rule: `> ${String(LONG_WINDOW_FACTOR)} x median window`, long });
        expect(long).toEqual([]);
      });
      await test.step('[IT-ML-062] G5-windows: no tile-cut slivers', async () => {
        const { cut: frag, thinOffCut } = fragmentReport(doc, sample.px);
        await saveJson('IT-ML-062_G5_fragments', { frag, thinOffCut });
        expect(frag).toEqual([]);
      });
    }
  });
}

/* ================================================================================================= */
/* C — registry, read only                                                                           */
/* ================================================================================================= */

test('C registry read', async () => {
  await test.step('[IT-ML-041] N27: both active versions completed with metrics', async () => {
    for (const [key, id] of Object.entries(ACTIVE)) {
      const res = await api.get(`/api/admin/ml/model-versions/${id}`);
      const body = (await captureExchange(`IT-ML-041_${key}.json`, { method: 'GET', path: `/api/admin/ml/model-versions/${id}` }, res, [
        'evaluationStatus completed, metrics present (ModelVersionSchema refine)',
      ])) as Json;
      expect(res.status()).toBe(200);
      expect(body.evaluationStatus).toBe('completed');
      expect(body.metrics).toBeTruthy();
    }
  });
});

/* ================================================================================================= */
/* D — failures                                                                                      */
/* ================================================================================================= */

test('D not a floor plan', async () => {
  test.setTimeout(2 * RUN_TIMEOUT_MS);

  await test.step('[IT-ML-050] N1 photo → run failed NOT_A_FLOOR_PLAN, no retry', async () => {
    const trace = await run('n1-photo', goldenPng('N1-photo'));
    await saveJson('IT-ML-050_N1_trace', trace);
    expect(trace.status).toBe('failed');
    expect(trace.error).toBe('NOT_A_FLOOR_PLAN');
    // PermanentError: no Celery retry, so the run ends well before the first backoff chain (10 + 60 + 300 s).
    expect(trace.ms, 'failed fast (permanent, not retried)').toBeLessThan(370_000);
  });

  await test.step('[IT-ML-052] N2 blank white page → run failed NOT_A_FLOOR_PLAN', async () => {
    const trace = await run('n2-blank', blankPng());
    await saveJson('IT-ML-052_N2_trace', trace);
    expect(trace.status).toBe('failed');
    expect(trace.error).toBe('NOT_A_FLOOR_PLAN');
  });

  await test.step('[IT-ML-056] a real plan right after a failure still completes (queue not stuck)', async () => {
    const trace = await run('after-fail', goldenPng('G1-small'));
    await saveJson('IT-ML-056_after_fail_trace', trace);
    expect(trace.status, trace.error).toBe('completed');
  });
});

test('D rejected uploads', async () => {
  const project = await api.post('/api/projects', {
    data: { name: `${TEST_DATA_PREFIX}itml-reject-${Date.now().toString(36)}`, floors: [{ name: 'Tầng 1', order: 0, elevationMm: 0, heightMm: 3_000 }] },
  });
  expect(project.status()).toBe(201);
  const pid = String(((await project.json()) as Json).id);
  projects.push(pid);
  const floors = (((await (await api.get(`/api/projects/${pid}`)).json()) as Json).floors as Json[]) ?? [];
  const fid = String(floors[0]?.id);
  const base = `/api/projects/${pid}/drawings/uploads`;

  const init = async (sizeBytes: number, fileName: string): Promise<string> => {
    const res = await api.post(`/api/projects/${pid}/floors/${fid}/drawings/uploads`, {
      data: { fileName, floorId: fid, mimeType: 'image/png', projectId: pid, sizeBytes },
    });
    expect(res.status(), 'init #5').toBe(200);
    return String(((await res.json()) as Json).id);
  };
  const complete = (uid: string) => api.post(`${base}/${uid}/complete`, { data: { uploadId: uid } });

  await test.step('[IT-ML-053] .png whose bytes are not a PNG → #7 422 with a code', async () => {
    const bytes = Buffer.from('this is plain text pretending to be a png file');
    const uid = await init(bytes.length, 'not-a-png.png');
    expect((await api.post(`${base}/${uid}/chunks`, { data: { chunk: bytes.toString('base64'), chunkIndex: 0 } })).status()).toBe(200);
    const res = await complete(uid);
    const body = (await captureExchange('IT-ML-053_bad_magic.json', { method: 'POST', path: `${base}/:uid/complete` }, res, ['422 W7 body with a code'])) as Json;
    expect(res.status()).toBe(422);
    expect(typeof body.code).toBe('string');
  });

  await test.step('[IT-ML-054] no chunk sent → #7 422 UPLOAD_INCOMPLETE', async () => {
    const png = goldenPng('G1-small');
    const uid = await init(png.length, 'incomplete.png');
    const res = await complete(uid);
    const body = (await captureExchange('IT-ML-054_incomplete.json', { method: 'POST', path: `${base}/:uid/complete` }, res, ['422 UPLOAD_INCOMPLETE'])) as Json;
    expect(res.status()).toBe(422);
    expect(body.code).toBe('UPLOAD_INCOMPLETE');
  });

  await test.step('[IT-ML-055] declared size ≠ bytes sent → 422 UPLOAD_SIZE_MISMATCH (at #6 or #7)', async () => {
    const png = goldenPng('G1-small');
    const uid = await init(png.length + 10, 'mismatch.png');
    const chunk = await api.post(`${base}/${uid}/chunks`, { data: { chunk: png.toString('base64'), chunkIndex: 0 } });
    const res = chunk.status() === 200 ? await complete(uid) : chunk;
    const body = (await captureExchange('IT-ML-055_size_mismatch.json', { method: 'POST', path: `${base}/:uid/(chunks|complete)` }, res, ['422 UPLOAD_SIZE_MISMATCH'])) as Json;
    expect(res.status()).toBe(422);
    expect(body.code).toBe('UPLOAD_SIZE_MISMATCH');
  });
});

/* ================================================================================================= */
/* F — concurrency and performance (recorded; only hard failures fail)                               */
/* ================================================================================================= */

test('F two uploads at once both complete', async () => {
  test.setTimeout(2 * RUN_TIMEOUT_MS + 60_000);
  await test.step('[IT-ML-070] G1 + G2 in parallel → both completed (second one queues behind concurrency 1)', async () => {
    const [a, b] = await Promise.all([
      run('f-par-a', goldenPng('G1-small'), { timeoutMs: 2 * RUN_TIMEOUT_MS }),
      run('f-par-b', goldenPng('G2-medium'), { timeoutMs: 2 * RUN_TIMEOUT_MS }),
    ]);
    await saveJson('IT-ML-070_parallel', { a, b });
    expect([a.status, b.status], `${a.error} ${b.error}`).toEqual(['completed', 'completed']);
  });
});

test('F large page time and memory', async () => {
  test.setTimeout(RUN_TIMEOUT_MS + 60_000);
  const trace = await run('n4-large', goldenPng('N4-large'), { sampleMemory: true });

  await test.step('[IT-ML-071] time per page recorded; > 5 min is a warning, not a failure', async () => {
    await saveJson('IT-ML-071_timing', { ms: trace.ms, steps: trace.steps });
    if (trace.ms > SLOW_PAGE_MS) test.info().annotations.push({ type: 'slow', description: `N4 ${String(trace.ms)} ms` });
  });

  await test.step('[IT-ML-072] N4 29.5 MP completes, no TASK_TIMEOUT, ml memory peak under mem_limit 12 GiB', async () => {
    await saveJson('IT-ML-072_n4', { status: trace.status, error: trace.error, mlPeakMiB: trace.mlPeakMiB });
    expect(trace.error).not.toBe('TASK_TIMEOUT');
    expect(trace.status, trace.error).toBe('completed');
    expect(trace.mlPeakMiB).toBeLessThan(12 * 1024);
  });
});
