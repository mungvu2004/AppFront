/**
 * Own drawing for the SCR-11 states the env drawing never shows (BUG-364): `render_plan(7)` is straight, so it has no
 * SKEW_DETECTED finding ("Tự động nắn") and no "poor" metric (acknowledgement checkbox). This rotates that PNG by
 * {@link SKEW_DEG} in a browser canvas (no image dependency), uploads it to a run-unique `qa-<runId>-…` project through
 * the real API (FE body: uploadTask.ts; same calls as `phase03_pipeline_api.spec.ts` happy path) and waits until the
 * quality read (#30) lists the skew finding. Pattern of `layerSeed.ts` (phase 04): create → seed → caller deletes.
 *
 * Why 8°: BE packages/vision/quality/thresholds.py and FE src/domain/quality/thresholds.ts agree that |skew| > 0.5° is a
 * SKEW_DETECTED finding (`actionKind: 'straighten'`, useInputQualityGate.ts:314-323) and ≥ 5° is "poor", which makes
 * `requiresAcknowledgement` true (useInputQualityGate.ts:1018). `estimate_skew` folds into (-45°, 45°] (geometry.py).
 *
 * BUG-346: {@link createPipelineDrawingProject} uploads the env drawing as it is and waits for the finished run instead
 * (phase 04 SCR-18 / SCR-14 / SCR-22, which used to read Phase 3's CP-5 work floor). {@link createPipelineProject}
 * (phase 6) does the same wait and then for the run's two versions (N17).
 *
 * Budget per seeded project: `POST /api/projects` 1, `GET /api/projects/:id` 1, upload init/chunk/complete 3 (init counts
 * against `drawings_init` 60 / 600 s per user, BE drawings/settings.py:135-136), progress / quality / N17 polls every
 * 1-2 s, `DELETE` 1 (by the caller) — one real pipeline run of the fake ML (≤ PIPELINE_TIMEOUT_MS).
 */
import { readFileSync } from 'node:fs';

import { expect, type APIRequestContext, type Browser } from '@playwright/test';

import { ImageQualityAssessmentSchema } from '../../../src/api/schemas/quality';
import { PIPELINE_TIMEOUT_MS } from '../../../e2e/fullstack/env';
import { TEST_DATA_PREFIX } from './evidence';

type Json = Record<string, unknown>;

const PROJECTS = '/api/projects';
/** ≥ 5°: "poor" skew on both sides (see the file comment). */
export const SKEW_DEG = 8;
/** `UPLOAD_CHUNK_BYTES` (BE drawings/settings.py:131): one chunk keeps the upload to init → chunk 0 → complete. */
const CHUNK_BYTES = 5 * 1024 * 1024;

export interface SeededDrawing {
  readonly projectId: string;
  readonly floorId: string;
  readonly floorName: string;
}

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

/** The PNG at `pngPath` rotated by `deg` on a white canvas large enough to keep every corner. */
export async function rotatedPng(browser: Browser, pngPath: string, deg: number): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    const dataUrl = await page.evaluate(
      async ({ src, angle }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const rad = (angle * Math.PI) / 180;
        const w = Math.ceil(img.width * Math.abs(Math.cos(rad)) + img.height * Math.abs(Math.sin(rad)));
        const h = Math.ceil(img.width * Math.abs(Math.sin(rad)) + img.height * Math.abs(Math.cos(rad)));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx === null) throw new Error('no 2d canvas');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        return canvas.toDataURL('image/png');
      },
      { src: `data:image/png;base64,${readFileSync(pngPath).toString('base64')}`, angle: deg },
    );
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await page.close();
  }
}

/** Deletes a fixture project; 200 / 404 are fine, anything else is returned for an annotation, never thrown. */
export async function deleteSeededProject(api: APIRequestContext, projectId: string): Promise<string | null> {
  try {
    const res = await api.delete(`${PROJECTS}/${projectId}`);
    return res.status() === 200 || res.status() === 404 ? null : `DELETE ${PROJECTS}/${projectId} → ${String(res.status())}`;
  } catch (error) {
    return `DELETE ${PROJECTS}/${projectId}: ${String(error)}`;
  }
}

/**
 * Uploads `png` (one chunk, ≤ {@link CHUNK_BYTES}) to `floorId` as `fileName`: #5 init → #6 chunk 0 → #7 complete
 * (drawings/router.py; FE body uploadTask.ts:424-433); each step must answer 200. Returns the upload id (#8 key).
 */
export async function uploadDrawing(
  api: APIRequestContext,
  projectId: string,
  floorId: string,
  png: Buffer,
  fileName: string,
): Promise<string> {
  const base = `${PROJECTS}/${projectId}/drawings/uploads`;
  const init = await api.post(`${PROJECTS}/${projectId}/floors/${floorId}/drawings/uploads`, {
    data: { fileName, floorId, mimeType: 'image/png', projectId, sizeBytes: png.length },
  });
  expect(init.status(), 'setup: upload init (#5)').toBe(200);
  const uploadId = String(asRecord(await init.json(), 'init').id);
  const chunk = await api.post(`${base}/${uploadId}/chunks`, { data: { chunk: png.toString('base64'), chunkIndex: 0 } });
  expect(chunk.status(), 'setup: upload chunk 0 (#6)').toBe(200);
  const done = await api.post(`${base}/${uploadId}/complete`, { data: { uploadId } });
  expect(done.status(), `setup: upload complete (#7): ${(await done.text()).slice(0, 300)}`).toBe(200);
  return uploadId;
}

/** Project `qa-<runId>-<slug>-<uniq>` with `floorNames`; `png` uploaded to the FIRST floor (#5 init → #6 chunk 0 → #7). */
export async function createDrawingProject(
  api: APIRequestContext,
  slug: string,
  png: Buffer,
  floorNames: readonly string[],
): Promise<SeededDrawing & { readonly uploadId: string }> {
  expect(png.length, 'fixture drawing fits one upload chunk').toBeLessThanOrEqual(CHUNK_BYTES);
  const name = `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await api.post(PROJECTS, {
    data: { name, floors: floorNames.map((floorName, order) => ({ name: floorName, order, elevationMm: order * 3_000, heightMm: 3_000 })) },
  });
  expect(created.status(), `setup: POST ${PROJECTS} "${name}"`).toBe(201);
  const projectId = asRecord(await created.json(), `POST ${PROJECTS}`).id;
  if (typeof projectId !== 'string' || projectId === '') throw new Error(`POST ${PROJECTS}: no project id`);
  try {
    const read = await api.get(`${PROJECTS}/${projectId}`);
    expect(read.status(), `setup: GET ${PROJECTS}/${projectId}`).toBe(200);
    const rows = asRecord(await read.json(), `GET ${PROJECTS}/:id`).floors;
    const floorName = floorNames[0] ?? '';
    const row = Array.isArray(rows) ? rows.map((item) => asRecord(item, 'floor')).find((item) => item.name === floorName) : undefined;
    const floorId = row?.id;
    if (typeof floorId !== 'string') throw new Error(`setup: the fixture floor "${floorName}" was not created`);

    const uploadId = await uploadDrawing(api, projectId, floorId, png, `${name}.png`);
    return { projectId, floorId, floorName, uploadId };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/**
 * Project `qa-<runId>-<slug>-<uniq>` with one floor holding `png` as its drawing; resolves once #30 reports the floor
 * measured with a SKEW_DETECTED finding. Deletes the project again when any setup step fails.
 */
export async function createSkewedDrawingProject(api: APIRequestContext, slug: string, png: Buffer): Promise<SeededDrawing> {
  const { projectId, floorId, floorName } = await createDrawingProject(api, slug, png, ['Tầng 1']);
  try {
    // #30 answers 404 until the drawing is stored, then `isMeasured` once the quality step has run.
    await expect
      .poll(
        async () => {
          const res = await api.get(`${PROJECTS}/${projectId}/floors/${floorId}/quality`);
          if (res.status() !== 200) return `#30 ${String(res.status())}`;
          const floor = ImageQualityAssessmentSchema.parse(await res.json()).floors.find((f) => f.floorId === floorId);
          if (floor?.isMeasured !== true) return 'not measured';
          return floor.findings.some((f) => f.code === 'SKEW_DETECTED') ? 'skew' : `findings ${floor.findings.map((f) => f.code).join(',')}`;
        },
        { message: `setup: #30 lists SKEW_DETECTED for the ${String(SKEW_DEG)}° drawing`, timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
      )
      .toBe('skew');
    return { projectId, floorId, floorName };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/**
 * QA-03d (SCR-11 "Các tầng đã đo"): project `qa-<runId>-<slug>-<uniq>` with `floorNames`, `png` uploaded to EVERY floor
 * (#5 → #6 → #7 per floor, same body as {@link createDrawingProject}); resolves once #30 lists every floor `isMeasured`
 * (BE quality/assessments.py:253-279: `floors` = floors with a live drawing). Deletes the project on any setup failure.
 * Budget: one `drawings_init` and one fake-ML run per floor, #30 polls every 2 s.
 */
export async function createMeasuredFloorsProject(
  api: APIRequestContext,
  slug: string,
  png: Buffer,
  floorNames: readonly string[],
): Promise<{ readonly projectId: string; readonly floors: readonly { readonly id: string; readonly name: string }[] }> {
  const first = await createDrawingProject(api, slug, png, floorNames);
  const { projectId } = first;
  try {
    const read = await api.get(`${PROJECTS}/${projectId}`);
    expect(read.status(), `setup: GET ${PROJECTS}/${projectId}`).toBe(200);
    const rows = asRecord(await read.json(), `GET ${PROJECTS}/:id`).floors;
    const floors = floorNames.map((name) => {
      const row = Array.isArray(rows) ? rows.map((item) => asRecord(item, 'floor')).find((item) => item.name === name) : undefined;
      if (typeof row?.id !== 'string') throw new Error(`setup: floor "${name}" was not created`);
      return { id: row.id, name };
    });
    const base = `${PROJECTS}/${projectId}/drawings/uploads`;
    for (const floor of floors.slice(1)) {
      const init = await api.post(`${PROJECTS}/${projectId}/floors/${floor.id}/drawings/uploads`, {
        data: { fileName: `${slug}-${floor.id}.png`, floorId: floor.id, mimeType: 'image/png', projectId, sizeBytes: png.length },
      });
      expect(init.status(), `setup: upload init (#5) for ${floor.name}`).toBe(200);
      const uploadId = String(asRecord(await init.json(), 'init').id);
      const chunk = await api.post(`${base}/${uploadId}/chunks`, { data: { chunk: png.toString('base64'), chunkIndex: 0 } });
      expect(chunk.status(), `setup: upload chunk 0 (#6) for ${floor.name}`).toBe(200);
      const done = await api.post(`${base}/${uploadId}/complete`, { data: { uploadId } });
      expect(done.status(), `setup: upload complete (#7) for ${floor.name}`).toBe(200);
    }
    await expect
      .poll(
        async () => {
          const res = await api.get(`${PROJECTS}/${projectId}/floors/${first.floorId}/quality`);
          if (res.status() !== 200) return `#30 ${String(res.status())}`;
          const listed = ImageQualityAssessmentSchema.parse(await res.json()).floors;
          return `${String(listed.filter((f) => f.isMeasured).length)}/${String(floors.length)}`;
        },
        { message: 'setup: #30 lists every floor measured', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
      )
      .toBe(`${String(floors.length)}/${String(floors.length)}`);
    return { projectId, floors };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/**
 * Polls #8 progress of `uploadId` every 2 s until `completed` (BE drawings/progress.py:33-68). Own loop, not
 * `expect.poll`: a `failed` run throws with its error code at once, not after PIPELINE_TIMEOUT_MS.
 */
async function waitForPipelineRun(api: APIRequestContext, projectId: string, uploadId: string): Promise<void> {
  const deadline = Date.now() + PIPELINE_TIMEOUT_MS;
  for (;;) {
    const res = await api.get(`${PROJECTS}/${projectId}/drawings/uploads/${uploadId}/progress`);
    const progress: Json = res.status() === 200 ? asRecord(await res.json(), '#8 progress') : { status: `#8 ${String(res.status())}` };
    if (progress.status === 'completed') return;
    if (progress.status === 'failed') throw new Error(`setup: the fixture pipeline run failed: ${String(progress.error)}`);
    if (Date.now() > deadline) throw new Error(`setup: #8 progress still "${String(progress.status)}" after ${String(PIPELINE_TIMEOUT_MS)} ms`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

/**
 * BUG-346 (phase 04 SCR-18 / SCR-14 / SCR-22): project `qa-<runId>-<slug>-<uniq>` whose one floor holds `png` (the env
 * drawing, straight) and has run the whole fake-ML pipeline: resolves once #8 progress of the upload is `completed`
 * (BE drawings/progress.py:33-68; a `failed` run throws with its error code at once) and the floor's N16 read answers 200 —
 * the pipeline output (warped drawing, source scan, OCR dimensions, AI layer) the CP-5 work floor used to provide. Same
 * readiness signal as phase03 `[BUG-285]` (CP-5 from the API). Deletes the project again when any setup step fails.
 * Budget: as the file comment (one `drawings_init`, one fake-ML run) + one #8 GET per 2 s + one N16 GET.
 */
export async function createPipelineDrawingProject(api: APIRequestContext, slug: string, png: Buffer): Promise<SeededDrawing> {
  const { projectId, floorId, floorName, uploadId } = await createDrawingProject(api, slug, png, ['Tầng 1']);
  try {
    await waitForPipelineRun(api, projectId, uploadId);
    const layer = await api.get(`${PROJECTS}/${projectId}/floors/${floorId}/spatial/layer`);
    expect(layer.status(), 'setup: N16 GET …/spatial/layer of the fixture floor after the run').toBe(200);
    return { projectId, floorId, floorName };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}

/**
 * Phase 6 (versions): project `qa-<runId>-<slug>-<uniq>` whose FIRST floor holds `png` (the straight env drawing) and
 * a finished fake-ML run. Only the pipeline creates versions (BE apps/worker/pipeline_persist/service.py:182-198: a
 * "before" + an "after" version; autosave never makes one), so this waits for #8 `completed` and then for N17 to list
 * both — the same calls as `phase06_rules_export_versions_api.spec.ts` pipelineProject. The AI ("after") version stays
 * "Hiện tại" until the caller writes the layer once (CP-6, `layerSeed.ts` writeLayer). Deletes the project on failure.
 */
export async function createPipelineProject(
  api: APIRequestContext,
  slug: string,
  png: Buffer,
  floorNames: readonly string[] = ['Tầng 1'],
): Promise<SeededDrawing> {
  const { projectId, floorId, floorName, uploadId } = await createDrawingProject(api, slug, png, floorNames);
  try {
    await waitForPipelineRun(api, projectId, uploadId);
    const versions = `${PROJECTS}/${projectId}/versions?floorId=${encodeURIComponent(floorId)}`;
    await expect
      .poll(
        async () => {
          const res = await api.get(versions);
          if (res.status() !== 200) return -1;
          const items = asRecord(await res.json(), 'N17').items;
          return Array.isArray(items) ? items.length : -1;
        },
        { message: 'setup: N17 lists the pipeline "before" + "after" versions', timeout: 60_000, intervals: [1_000] },
      )
      .toBeGreaterThanOrEqual(2);
    return { projectId, floorId, floorName };
  } catch (error) {
    await deleteSeededProject(api, projectId);
    throw error;
  }
}
