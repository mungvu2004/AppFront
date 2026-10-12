/**
 * Phase 4 — SCR-22 Overlay Comparison, EDGE layer, MOCKED RESPONSES (QA-04c P7, flow-plan.md "phase04_overlay_mocked_edge.spec.ts").
 * One flow, FL-22-M1, one `test.step('[<row id>] …')` per catalog row in the planned order. The title carries
 * `[mocked response]`: loading windows, 4xx/5xx/abort and contract shapes of #30 (`GET …/floors/:f/quality`) and N16
 * (`GET …/floors/:f/spatial/layer`) cannot be produced on the shared stack. What is real: the project (D1, env drawing, finished
 * run), its floors, the session and every request the mocks do not touch. Rewrites start from the REAL #30 answer
 * (`route.fetch()`) and change only the field under test. Rows marked ⚑ assert the EXPECTED behaviour (red = app-bug candidate).
 *
 * Source (FE): UOC src/screens/viewer/OverlayComparison/useOverlayComparison.ts · OCG …/overlayComparisonGateway.ts ·
 * OC …/OverlayComparison.tsx · OCL …/OverlayComparisonCanvasLayers.tsx · HTTP src/lib/http/{client,retry}.ts (ladder 300/900/2700 ms
 * on 429/502/503/504 only).
 *
 * ## Request budget
 * Logins: 2 API (main admin lookup + pool admin of slot `p04-overlay`) + 1 browser session. One upload (D1, `drawings_init` of the
 * pool admin). `POST /api/projects` 1 (+1 DELETE). Refresh ≈ 1 per page load (≈ 25).
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { holdFirst } from './support/p03/P8';
import { OV, alertWith, noticeRegion, noticeText, ownerApi, screenRegion, seedD1, toolbar } from './support/p04/P7';

const QUALITY = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/quality$/u;
const LAYER = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;
const REFRESH = '/api/auth/refresh';
const RETRY_CONTROL = /thử lại|tải lại/iu;

const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${row}_${slug}.png`, caption === undefined ? {} : { caption });
const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

/** GET-only route on a path regex; every other method falls through. */
async function onGet(page: Page, re: RegExp, answer: (route: Route) => Promise<void>): Promise<void> {
  await page.route(
    (url) => re.test(url.pathname),
    async (route) => (route.request().method() === 'GET' ? answer(route) : route.fallback()),
  );
}

const wire = (route: Route, status: number, body: Record<string, unknown>): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ requestId: 'qa-p7-mock', ...body }) });

/** #30 answered by the real backend with `mutate` applied to the floors; `onReal` sees the real body first. */
async function rewriteQuality(page: Page, mutate: (floors: Record<string, unknown>[]) => void): Promise<void> {
  await onGet(page, QUALITY, async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { floors: Record<string, unknown>[] };
    mutate(body.floors);
    await route.fulfill({ response, json: body });
  });
}

/** Counts GETs of #30 / N16 the page sends (requests, not responses: a mocked answer is still a request). */
function countGets(page: Page, re: RegExp): () => number {
  let n = 0;
  page.on('request', (request) => {
    if (request.method() === 'GET' && re.test(new URL(request.url()).pathname)) n += 1;
  });
  return () => n;
}

const reset = async (page: Page): Promise<void> => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
};

test.describe('SCR-22 overlay — mocked-response flow (QA-04c P7)', () => {
  test('SCR-22 · FL-22-M1 · [mocked response] #30 and N16 failures, contract branches, image 404', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const owner = await ownerApi();
    let flow: Flow | undefined;
    let d1: { projectId: string; floorId: string; floorName: string } | undefined;
    try {
      d1 = await seedD1(owner.api, '22-m1');
      flow = await openFlow(browser, owner.user);
      const { page, log } = flow;
      const { projectId, floorId } = d1;
      const qualityGets = countGets(page, QUALITY);
      const layerGets = countGets(page, LAYER);

      await test.step('[22-B-001] [mock] loading (#30 in flight): plain text, role status, no alert', async () => {
        const hold = await holdFirst(page, QUALITY);
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await hold.seen;
        const status = page.getByRole('status').filter({ hasText: OV.loading });
        await expect(status).toBeVisible();
        await expect.soft(status).toHaveText(OV.loading);
        await expect.soft(page.getByRole('alert'), 'no alert while loading').toHaveCount(0);
        await ev(page, '22-B-001', 'loading');
        await hold.release();
        await expect(alertWith(page, OV.frameMissing)).toBeVisible();
        await reset(page);
      });

      await test.step('[22-B-002] ⚑ [mock] N16 in flight (store empty): a loading state, not "Dự án này chưa có tầng nào…"', async () => {
        const hold = await holdFirst(page, LAYER);
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await hold.seen;
        await expect(screenRegion(page)).toBeVisible();
        await expect(toolbar(page)).toBeVisible();
        await ev(page, '22-B-002', 'n16_in_flight');
        await expect.soft(page.getByText(OV.noFloor, { exact: true }), 'N16 has not answered: the project is not "empty"').toHaveCount(0);
        await expect.soft(page.getByText(OV.loading, { exact: true })).toBeVisible();
        await hold.release();
        await expect(alertWith(page, OV.frameMissing)).toBeVisible();
        await reset(page);
      });

      await test.step('[22-B-004] ⚑ [mock] #30 read fails: alert without scale link, with a retry control', async () => {
        await onGet(page, QUALITY, (route) => wire(route, 500, { code: 'INTERNAL' }));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(alertWith(page, OV.readFailed)).toBeVisible({ timeout: 30_000 });
        await expect.soft(page.getByRole('link', { name: OV.toScale })).toHaveCount(0);
        await ev(page, '22-B-004', 'read_failed');
        await expect.soft(page.getByRole('button', { name: RETRY_CONTROL }), 'no retry control next to the read error').not.toHaveCount(0);
        await reset(page);
      });

      await test.step('[22-B-009] ⚑ [mock] N16 read failed: a read error, not "Dự án này chưa có tầng nào…"', async () => {
        await onGet(page, LAYER, (route) => wire(route, 500, { code: 'INTERNAL' }));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(screenRegion(page)).toBeVisible();
        await expect(noticeRegion(page)).toBeVisible({ timeout: 30_000 });
        await ev(page, '22-B-009', 'n16_failed');
        await expect.soft(page.getByText(OV.noFloor, { exact: true }), 'wrong cause: the read failed, the project has floors').toHaveCount(0);
        await reset(page);
      });

      await test.step('[22-B-015] [mock] scan image fails to load (404 sourceUrl): empty layer, no notice of its own', async () => {
        let imageHost = '';
        await rewriteQuality(page, (floors) => {
          for (const floor of floors) {
            floor.frame = { isFound: true };
            floor.findings = (floor.findings as { code: string }[]).filter((f) => f.code !== 'FRAME_NOT_FOUND');
            imageHost = String(floor.sourceUrl).split('?')[0] ?? '';
          }
        });
        await page.route(
          (url) => imageHost !== '' && url.href.split('?')[0] === imageHost,
          (route) => route.fulfill({ status: 404, body: '' }),
        );
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(toolbar(page)).toBeVisible();
        const img = page.locator('[data-overlay-layer="scan"] img');
        await expect(img).toHaveCount(1);
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete)).toBe(true);
        expect.soft(await img.evaluate((el: HTMLImageElement) => el.naturalWidth), 'the image never decoded').toBe(0);
        const shown = await noticeText(page);
        expect.soft(shown === null || !/ảnh/iu.test(shown), `no notice about the image (notice: ${shown ?? 'none'})`).toBe(true);
        await ev(page, '22-B-015', 'image_404', `notice: ${shown ?? 'none'}`);
        await reset(page);
      });

      await test.step('[22-C-001] [mock] the frame counts as missing when frame.isFound is false OR a FRAME_NOT_FOUND finding exists', async () => {
        await rewriteQuality(page, (floors) => {
          for (const floor of floors) {
            floor.frame = { isFound: true };
            // D1 already lists a real FRAME_NOT_FOUND finding: keep it, only the flag changes.
          }
        });
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(toolbar(page)).toBeVisible();
        await expect.soft(alertWith(page, OV.frameMissing), 'frame.isFound true + FRAME_NOT_FOUND finding → missing').toBeVisible();
        await reset(page);
        await rewriteQuality(page, (floors) => {
          for (const floor of floors) {
            floor.frame = { isFound: false };
            floor.findings = (floor.findings as { code: string }[]).filter((f) => f.code !== 'FRAME_NOT_FOUND');
          }
        });
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(toolbar(page)).toBeVisible();
        await expect.soft(alertWith(page, OV.frameMissing), 'frame.isFound false, no finding → missing').toBeVisible();
        await ev(page, '22-C-001', 'frame_flag_only');
        await reset(page);
      });

      await test.step('[22-C-002] [mock] imageUrl only when isMeasured: an unmeasured floor has no scan image', async () => {
        await rewriteQuality(page, (floors) => {
          for (const floor of floors) {
            floor.isMeasured = false;
            delete floor.measurement;
          }
        });
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(toolbar(page)).toBeVisible();
        await expect(noticeRegion(page)).toBeVisible();
        await expect.soft(page.locator('[data-overlay-layer="scan"] img'), 'no <img> for an unmeasured floor').toHaveCount(0);
        await expect.soft(page.getByRole('link', { name: OV.toUpload })).toHaveCount(0);
        await ev(page, '22-C-002', 'unmeasured_no_image');
        await reset(page);
      });

      await test.step('[22-C-003] [mock] only 404 `upload` is "no drawing": 404 `project` on #30 is a read error', async () => {
        await onGet(page, QUALITY, (route) => wire(route, 404, { code: 'NOT_FOUND', resource: 'project' }));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(noticeRegion(page)).toBeVisible();
        await expect.soft(alertWith(page, OV.readFailed)).toBeVisible();
        await expect.soft(page.getByText(OV.noDrawing, { exact: true })).toHaveCount(0);
        await ev(page, '22-C-003', 'project_404_is_read_error');
        await reset(page);
      });

      await test.step('[22-G-003] [mock] GET #30 404 `floor` → the read error notice', async () => {
        await onGet(page, QUALITY, (route) => wire(route, 404, { code: 'NOT_FOUND', resource: 'floor' }));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(noticeRegion(page)).toBeVisible();
        await expect.soft(alertWith(page, OV.readFailed)).toBeVisible();
        await ev(page, '22-G-003', 'floor_404');
        await reset(page);
      });

      await test.step('[22-G-004] [mock] GET #30 500 → read error, no retry control; a 503 is retried by the HTTP ladder (1 + 3) only', async () => {
        await onGet(page, QUALITY, (route) => wire(route, 500, { code: 'INTERNAL' }));
        const startAt = qualityGets();
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(alertWith(page, OV.readFailed)).toBeVisible({ timeout: 30_000 });
        const after500 = qualityGets() - startAt;
        note(`22-G-004: #30 requests until the 500 notice: ${String(after500)}`);
        expect.soft(after500, '500 is not on the ladder: the screen reads once (+ at most the query layer\'s one retry)').toBeLessThanOrEqual(2);
        await expect.soft(page.getByRole('button', { name: RETRY_CONTROL })).toHaveCount(0);
        await reset(page);
        await onGet(page, QUALITY, (route) => wire(route, 503, { code: 'UNAVAILABLE' }));
        const start503 = qualityGets();
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(alertWith(page, OV.readFailed)).toBeVisible({ timeout: 60_000 });
        expect.soft(qualityGets() - start503, '503: first request + the three ladder retries (300 / 900 / 2700 ms)').toBe(4);
        await ev(page, '22-G-004', 'status_503_ladder');
        await reset(page);
      });

      await test.step('[22-G-005] [mock] GET #30 network abort → the read error notice', async () => {
        await onGet(page, QUALITY, (route) => route.abort('failed'));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(alertWith(page, OV.readFailed)).toBeVisible({ timeout: 60_000 });
        await ev(page, '22-G-005', 'network_abort');
        await reset(page);
      });

      await test.step('[22-G-006] [mock] GET #30 401 mid-session → refresh, then the read succeeds (or /login)', async () => {
        let answered = false;
        await onGet(page, QUALITY, async (route) => {
          if (answered) return route.fallback();
          answered = true;
          return wire(route, 401, { code: 'UNAUTHENTICATED' });
        });
        const mark = log.length;
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect.poll(() => new URL(page.url()).pathname).not.toBe('/projects');
        const refreshed = log.slice(mark).filter((e) => e.method === 'POST' && e.path === REFRESH);
        note(`22-G-006: ${String(refreshed.length)} refresh call(s) after the 401; ended on ${new URL(page.url()).pathname}`);
        if (new URL(page.url()).pathname === '/login') {
          await ev(page, '22-G-006', 'ended_on_login');
        } else {
          await expect.soft(alertWith(page, OV.frameMissing), 'after the refresh the real #30 is read again').toBeVisible({ timeout: 30_000 });
          expect.soft(refreshed.length, 'a refresh happened between the 401 and the retry').toBeGreaterThanOrEqual(1);
          await ev(page, '22-G-006', 'refreshed_and_read');
        }
        await reset(page);
      });

      await test.step('[22-G-009] ⚑ [mock] GET N16 500 / abort → a read error, and no #30 call without a floor list', async () => {
        await onGet(page, LAYER, (route) => wire(route, 500, { code: 'INTERNAL' }));
        const q0 = qualityGets();
        const l0 = layerGets();
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(noticeRegion(page)).toBeVisible({ timeout: 30_000 });
        await expect.soft(page.getByText(OV.noFloor, { exact: true }), 'N16 500 is not "the project has no floors"').toHaveCount(0);
        expect.soft(qualityGets() - q0, 'no #30 call when N16 gave no floor').toBe(0);
        note(`22-G-009: N16 requests ${String(layerGets() - l0)}, notice "${(await noticeText(page)) ?? ''}"`);
        await ev(page, '22-G-009', 'n16_500');
        await reset(page);
        await onGet(page, LAYER, (route) => route.abort('failed'));
        await page.goto(ROUTES.project.overlay(projectId, floorId));
        await expect(noticeRegion(page)).toBeVisible({ timeout: 30_000 });
        await expect.soft(page.getByText(OV.noFloor, { exact: true }), 'N16 abort is not "the project has no floors"').toHaveCount(0);
        await reset(page);
      });

    } finally {
      if (flow !== undefined) await closeFlow(flow);
      if (d1 !== undefined) await deleteSeededProject(owner.api, d1.projectId);
      await owner.dispose();
    }
  });
});
