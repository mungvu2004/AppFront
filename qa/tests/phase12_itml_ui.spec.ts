/**
 * Phase 12 — IT-ML UI layer: the same integration as `phase12_itml_api.spec.ts`, seen through the screens. Plan:
 * `F:/App/docs/it-ml/IT-PLAN.md` group B (+ IT-ML-040, IT-ML-051). Run headed (qa.config defaults.watch) after the
 * API layer's G0 is green: this file does not re-check the stack.
 *
 * The QC lists are virtualised (`@tanstack/react-virtual`, WallLayerList.tsx:26), so counting rows in the DOM is
 * wrong by design. IT-ML-032/033 instead prove the screen read the SAME layer the API returns (the screen's own
 * N16 response vs a direct N16 read) and render it without an error state; the eye check is the evidence review.
 *
 * Read-only: own `qa-<runId>-itml-ui-…` projects, deleted in `finally`; no layer edits, no registry writes.
 * Budget: 3 UI logins + 3 API logins, 2 `drawings_init`, 2 real ML runs.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { signInAdmin } from './support/auth';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { createProject } from './support/phase03Seed';
import { FILE_INPUT } from './support/p03/P11';
import { ACTIVE, RUN_TIMEOUT_MS, adminApi, countsOf, goldenPng, readLayer, saveJson, uploadAndTrace } from './support/p12/itml';

type Json = Record<string, unknown>;

test.describe.configure({ mode: 'serial' });

/** FE src/screens/pipeline/pipelineErrorText.ts:71 and PipelineFailure/pipelineFailureText.ts:59. */
const NOT_A_PLAN_SENTENCE = 'Ảnh tải lên không giống bản vẽ mặt bằng: hệ thống không nhận ra đủ tường.';
const UPLOAD_CLEARER = 'Tải lên bản vẽ rõ hơn';
/** A blank / black WebGL canvas compresses to a few KB of PNG; a drawn plan is far bigger. */
const DRAWN_CANVAS_MIN_BYTES = 20_000; // ponytail: PNG size as a "something was drawn" proxy; decode pixels if it flakes

let api: APIRequestContext;
const projects: string[] = [];

test.beforeEach(async () => {
  api = await adminApi();
});

test.afterEach(async () => {
  for (const id of projects.splice(0)) {
    const problem = await deleteSeededProject(api, id);
    if (problem) test.info().annotations.push({ type: 'cleanup', description: problem });
  }
  await api.dispose();
});

/** Opens `path` and returns the layer the SCREEN fetched (its own N16 response). */
async function screenLayer(page: Page, path: string, projectId: string, floorId: string): Promise<Json> {
  const read = waitForApi(page, 'GET', new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u'), [200], RUN_TIMEOUT_MS);
  await page.goto(path);
  return (await read).json as Json;
}

const layerCounts = (json: Json): Json => {
  const layer = (json.layer ?? {}) as Record<string, Json[]>;
  const openings = layer.openings ?? [];
  return {
    walls: (layer.walls ?? []).length,
    doors: openings.filter((o) => o.kind === 'door').length,
    windows: openings.filter((o) => o.kind === 'window').length,
    furniture: (layer.furniture ?? []).length,
    rooms: (layer.rooms ?? []).length,
  };
};

test('B G1 through the screens: upload → processing → walls → objects → overlay → 3D', async ({ page }) => {
  test.setTimeout(RUN_TIMEOUT_MS + 180_000);
  const seeded = await createProject(api, 'itml-ui-g1', ['Tầng 1']);
  projects.push(seeded.projectId);
  const pid = seeded.projectId;
  const floor = seeded.floors[0];
  if (!floor) throw new Error('setup: no floor');

  await signInAdmin(page, ROUTES.project.upload(pid));

  await test.step('[IT-ML-030] upload screen: choose G1 → init → chunk → complete', async () => {
    const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${pid}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);
    await expect(page.getByTestId('floor-upload-dropzone')).toBeVisible();
    await page.getByTestId(FILE_INPUT).setInputFiles({ name: 'G1-small.png', mimeType: 'image/png', buffer: goldenPng('G1-small') });
    // The file name names no floor → it lands in the tray; assign it (phase03_pipeline.spec.ts SCR-10).
    const tray = page.getByRole('region', { name: 'Tệp chưa gán tầng', exact: true });
    if (await tray.isVisible().catch(() => false)) {
      await tray.getByRole('combobox', { name: 'Gán cho tầng khác' }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
    }
    await complete;
    await expect(page.locator(`[data-floor-id="${floor.id}"]`).getByText('Đã gắn kèm', { exact: true })).toBeVisible();
    await captureEvidence(page, 'U12_IT-ML-030_upload_attached.png');
  });

  await test.step('[IT-ML-031] processing screen ends "Đã xong 1/1 tầng" (real ML, CPU)', async () => {
    await page.goto(ROUTES.project.pipeline(pid));
    const done = page.getByText(/^Đã xong 1\/1 tầng/u);
    const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });
    await expect(done.or(failure).first()).toBeVisible({ timeout: RUN_TIMEOUT_MS });
    await captureEvidence(page, 'U12_IT-ML-031_processing_done.png');
    await expect(failure, 'pipeline failed on screen').toHaveCount(0);
  });

  const apiCounts = countsOf(await readLayer(api, pid, floor.id));

  await test.step('[IT-ML-032] walls screen reads the same layer as the API and shows no error', async () => {
    const seen = layerCounts(await screenLayer(page, ROUTES.project.walls(pid, floor.id), pid, floor.id));
    await expect(page.locator('[data-wall-id]').first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await captureEvidence(page, 'U12_IT-ML-032_walls.png', { caption: `API: ${String(apiCounts.walls)} tường` });
    await saveJson('IT-ML-032_walls_counts', { api: apiCounts, screen: seen });
    expect(seen.walls).toBe(apiCounts.walls);
  });

  await test.step('[IT-ML-033] objects screen reads the same openings + furniture as the API', async () => {
    const seen = layerCounts(await screenLayer(page, ROUTES.project.objects(pid, floor.id), pid, floor.id));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await captureEvidence(page, 'U12_IT-ML-033_objects.png', {
      caption: `API: ${String(apiCounts.doors)} cửa, ${String(apiCounts.windows)} cửa sổ, ${String(apiCounts.furniture)} đồ vật`,
    });
    await saveJson('IT-ML-033_objects_counts', { api: apiCounts, screen: seen });
    expect({ doors: seen.doors, windows: seen.windows, furniture: seen.furniture }).toEqual({
      doors: apiCounts.doors,
      windows: apiCounts.windows,
      furniture: apiCounts.furniture,
    });
  });

  await test.step('[IT-ML-034] overlay: result drawn over the source drawing (checked by eye in evidence review)', async () => {
    await page.goto(ROUTES.project.overlay(pid, floor.id));
    await expect(page.getByRole('alert')).toHaveCount(0);
    await captureEvidence(page, 'U12_IT-ML-034_overlay.png', { caption: 'Kiểm bằng mắt: tường/cửa nằm đè đúng ảnh gốc' });
  });

  await test.step('[IT-ML-035] 3D viewer draws the floor, no console errors', async () => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(ROUTES.project.viewer(pid));
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(3_000); // first frames of the render loop
    const shot = await canvas.screenshot();
    await captureEvidence(page, 'U12_IT-ML-035_viewer3d.png');
    await saveJson('IT-ML-035_viewer3d', { canvasPngBytes: shot.length, consoleErrors: errors });
    expect(shot.length, 'canvas looks empty (uniform image)').toBeGreaterThan(DRAWN_CANVAS_MIN_BYTES);
    expect(errors).toEqual([]);
  });
});

test('C admin models screen shows the two active versions', async ({ page }) => {
  await test.step('[IT-ML-040] /admin/models lists the active walls + objects labels', async () => {
    const labels: string[] = [];
    for (const id of Object.values(ACTIVE)) {
      const res = await api.get(`/api/admin/ml/model-versions/${id}`);
      expect(res.status()).toBe(200);
      labels.push(String(((await res.json()) as Json).label));
    }
    await signInAdmin(page, ROUTES.adminModels);
    for (const label of labels) await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    await captureEvidence(page, 'U12_IT-ML-040_admin_models.png', { caption: labels.join(' · ') });
  });
});

test('D not a floor plan on the failure screen', async ({ page }) => {
  test.setTimeout(RUN_TIMEOUT_MS + 120_000);
  const trace = await uploadAndTrace(api, 'ui-n1-photo', goldenPng('N1-photo'));
  projects.push(trace.projectId);
  expect(trace.error, 'setup: N1 must fail NOT_A_FLOOR_PLAN (see IT-ML-050)').toBe('NOT_A_FLOOR_PLAN');

  await test.step('[IT-ML-051] processing screen shows the NOT_A_FLOOR_PLAN sentence and the re-upload action', async () => {
    await signInAdmin(page, ROUTES.project.pipeline(trace.projectId));
    await expect(page.getByText(NOT_A_PLAN_SENTENCE)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(UPLOAD_CLEARER, { exact: true }).first()).toBeVisible();
    await captureEvidence(page, 'U12_IT-ML-051_not_a_floor_plan.png');
  });
});
