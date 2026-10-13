/**
 * Phase 4 — SCR-14 scale calibration, EDGE layer, MOCKED RESPONSES (QA-04c P6, `flow-plan.md` FL-14-M1): one flow, thirteen
 * catalog rows, one `test.step('[<row id>] …')` each, in the planned order. The title carries `[mocked response]`.
 *
 * Why mocked: the reads of the screen (#30 quality, N16 layer, N5 settings, #12 floors, N15 graph) and the scale PUT cannot be made
 * to fail, be held or answer a broken contract on the real stack. What stays real: the project, the drawing (D1: env drawing after a
 * finished fake-ML run, warped, provisional scale), the session. A held request is continued to the real BE afterwards; a failing
 * one is answered by `page.route` (no request reaches the BE, so D1 is never written). Pairing: BE5-G-018 (#30 after a run, FL-BE-01)
 * and A4 scale (FL-A4-07) cover the same endpoints for real.
 *
 * Source (FE, this branch): SC ScaleCalibration.tsx · SCV …Canvas.tsx · SCP …Panel.tsx · USC useScaleCalibration.ts ·
 * SCG scaleCalibrationGateway.ts · http retry ladder src/lib/http/retry.ts (GET: 300 / 900 / 2700 ms + jitter on 5xx) ·
 * SLS src/lib/autosave/spatialLayerSave.ts · UAS src/hooks/useAutosave.ts.
 *
 * ## Request budget per file run
 * - `POST /api/auth/login` 2 (owner) + 1 (flow session); `POST /api/projects` 1 (D1) + 1 upload init; refresh ≈ 1 per page load (≈ 14).
 * - No other write reaches the BE: every PUT is answered by the route.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import { closeSession, fulfillError, openSession, type Session } from './support/p03/P2';
import {
  ERR,
  SCALE,
  btn,
  canvasOf,
  dragLine,
  drawStandard,
  flush,
  lengthField,
  noticeOf,
  openScale,
  panelOf,
  putsSince,
  scopeRadio,
  sharedDrawingFloor,
  trackRequests,
  handleEnd,
  applyBtn,
  type Sent,
} from './support/p04/P6';

const shared = sharedDrawingFloor('14-m1');

test.beforeAll(async () => {
  test.setTimeout(300_000);
  await shared.setup();
});

test.afterAll(async () => {
  await shared.teardown();
});

const step = (id: string, title: string, body: () => Promise<void>): Promise<void> => test.step(`[${id}] ${title}`, body);
const evidence = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E04_${id}_${slug}.png`);
const apply = (page: Page) => btn(page, SCALE.apply);

/** `^/api/projects/<p>/floors/<f>/quality$` (#30) and the other reads of the screen. */
const urls = (projectId: string, floorId: string) => ({
  quality: new RegExp(`/api/projects/${projectId}/floors/${floorId}/quality$`, 'u'),
  layer: new RegExp(`/api/projects/${projectId}/floors/${floorId}/spatial/layer$`, 'u'),
  settings: new RegExp(`/api/projects/${projectId}/settings$`, 'u'),
  floors: new RegExp(`/api/projects/${projectId}/floors$`, 'u'),
  graph: new RegExp(`/api/projects/${projectId}/spatial$`, 'u'),
});

/** GET-only handler: `answer` for the GETs, everything else falls through. */
const onGet =
  (answer: (route: Route) => Promise<unknown>) =>
  async (route: Route): Promise<unknown> =>
    route.request().method() === 'GET' ? answer(route) : route.fallback();

/** Screen of the shared floor with the canvas drawn (the mocked reads decide what else is on it). */
async function gotoScale(page: Page, projectId: string, floorId: string): Promise<void> {
  await page.goto(ROUTES.project.scale(projectId, floorId));
}

test.describe('E04 SCR-14 scale calibration — mocked responses (QA-04c P6)', () => {
  test('SCR-14 · FL-14-M1 · [mocked response] reads and writes: held, 500, abort, 401, contract, image 404, N16 / settings / list / PUT failures', async ({ browser }) => {
    test.setTimeout(420_000);
    const { projectId, floorId } = shared.floor();
    const re = urls(projectId, floorId);
    const s: Session = await openSession(browser, shared.owner().user);
    const { page } = s;
    const sent: Sent[] = trackRequests(page);
    const count = (pattern: RegExp, from = 0): number => sent.slice(from).filter((r) => r.method === 'GET' && pattern.test(r.path)).length;
    try {
      await step('14-B-001', 'loading: canvas skeleton, panel skeleton, no notice, the method control loading (#30 held, then continued to the real BE)', async () => {
        let release = (): void => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(re.quality, onGet(async (route) => {
          await gate;
          return route.continue();
        }));
        await gotoScale(page, projectId, floorId);
        await expect(canvasOf(page)).toBeVisible();
        await expect.soft(canvasOf(page).locator('.animate-pulse').first(), 'canvas skeleton').toBeVisible(); // SCV:328-329
        await expect.soft(panelOf(page).locator('.animate-pulse').first(), 'panel skeleton').toBeVisible(); // SCP:102-104
        await expect.soft(noticeOf(page), 'no notice while loading').toHaveCount(0); // SC:89-97 (loading → null)
        await expect.soft(page.getByRole('radiogroup', { name: SCALE.methods, exact: true }).getByRole('radio'), 'method control is a skeleton').toHaveCount(0);
        await evidence(page, '14-B-001', 'loading');
        release();
        await expect(btn(page, SCALE.remeasure)).toBeVisible({ timeout: 45_000 });
      });

      await step('14-B-008', 'error: another read failure (500) shows describeError + "Mã lỗi: {code}" + back / retry', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const from = sent.length;
        await page.route(re.quality, onGet((route) => fulfillError(route, 500, 'INTERNAL_ERROR')));
        await gotoScale(page, projectId, floorId);
        const notice = noticeOf(page);
        await expect(notice.getByRole('alert')).toBeVisible({ timeout: 45_000 }); // after the HTTP ladder
        await expect.soft(notice).toContainText(ERR.unknown);
        await expect.soft(notice).toContainText(/Mã lỗi: [A-Z_]+/u);
        await expect.soft(btn(notice, SCALE.backToPreprocessing)).toBeVisible();
        await expect.soft(btn(notice, SCALE.retry)).toBeVisible();
        await evidence(page, '14-B-008', 'read-500');
        note500.from = from;
      });

      await step('14-G-004', 'GET …/quality 500 → errors.unknown + code; the read is retried by the HTTP ladder only (BUG-570)', async () => {
        // A 500 is not in RETRYABLE_STATUSES (429 / 502 / 503 / 504, lib/http/retry.ts) and the query layer adds none for a laddered read (queryClient.ts:21): exactly one request.
        expect.soft(count(re.quality, note500.from), 'requests for one failing screen open').toBe(1);
        await evidence(page, '14-G-004', 'ladder-count');
      });

      await step('14-G-005', 'GET …/quality network abort → "Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại."', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.quality, onGet((route) => route.abort('failed')));
        await gotoScale(page, projectId, floorId);
        await expect(noticeOf(page).getByRole('alert')).toBeVisible({ timeout: 45_000 });
        await expect.soft(noticeOf(page)).toContainText(ERR.network);
        await evidence(page, '14-G-005', 'read-abort');
      });

      await step('14-G-006', 'GET …/quality 401 mid-session → refresh then the read (or /login)', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        let first = true;
        await page.route(re.quality, onGet((route) => {
          if (!first) return route.continue();
          first = false;
          return fulfillError(route, 401, 'UNAUTHENTICATED');
        }));
        const from = sent.length;
        await gotoScale(page, projectId, floorId);
        await expect(btn(page, SCALE.remeasure)).toBeVisible({ timeout: 45_000 });
        expect.soft(sent.slice(from).filter((r) => r.method === 'POST' && r.path === '/api/auth/refresh').length, 'a refresh before the retried read').toBeGreaterThanOrEqual(1);
        expect.soft(count(re.quality, from), 'the read was repeated after the refresh').toBeGreaterThanOrEqual(2);
        await expect.soft(canvasOf(page)).toBeVisible();
        await evidence(page, '14-G-006', 'read-401');
      });

      await step('14-G-007', 'GET …/quality 200 without the route floor → a contract error (not an empty record)', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.quality, onGet(async (route) => {
          const real = await route.fetch();
          const body = (await real.json()) as { floors?: unknown[] };
          return route.fulfill({ response: real, json: { ...body, floors: [] } });
        }));
        await gotoScale(page, projectId, floorId);
        const notice = noticeOf(page);
        await expect(notice.getByRole('alert')).toBeVisible({ timeout: 45_000 }); // SCG:296-311
        await expect.soft(notice).toContainText('Mã lỗi');
        await expect.soft(notice.getByText(SCALE.emptyTitle, { exact: true }), 'not the empty-record state').toHaveCount(0);
        await evidence(page, '14-G-007', 'contract-error');
      });

      await step('14-B-028', 'drawing image URL fails to load (expired / 404): broken image, no notice (no onError)', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const read = await shared.owner().api.get(`/api/projects/${projectId}/floors/${floorId}/quality`);
        const floors = ((await read.json()) as { floors: { floorId: string; sourceUrl: string }[] }).floors;
        const source = new URL(floors.find((f) => f.floorId === floorId)?.sourceUrl ?? '', 'http://x');
        await page.route((url) => url.pathname === source.pathname && !/\/api\/projects\/[^/]+\/floors\/[^/]+\/quality$/u.test(url.pathname), (route) =>
          route.fulfill({ status: 404, body: 'gone' }),
        );
        await gotoScale(page, projectId, floorId);
        await expect(btn(page, SCALE.remeasure)).toBeVisible({ timeout: 45_000 });
        const img = canvasOf(page).locator('img');
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete)).toBe(true);
        expect.soft(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth), 'broken image').toBe(0); // SCV:340-347
        await expect.soft(noticeOf(page).getByRole('alert'), 'only the warped notice, no image-error notice').toHaveCount(1);
        await evidence(page, '14-B-028', 'image-404');
      });

      await step('14-G-009', 'N16 500 / network → the canvas still works (a line can be drawn)', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.layer, onGet((route) => fulfillError(route, 500, 'INTERNAL_ERROR')));
        await gotoScale(page, projectId, floorId);
        await expect(btn(page, SCALE.remeasure)).toBeVisible({ timeout: 45_000 });
        await expect(canvasOf(page).locator('img')).toHaveJSProperty('complete', true);
        await dragLine(page, [0.2, 0.5], [0.8, 0.5]);
        await lengthField(page).fill('5000');
        await expect.soft(handleEnd(page)).toBeVisible();
        await expect.soft(apply(page), 'a ratio exists, so apply is enabled until it is pressed').toBeEnabled();
        await evidence(page, '14-G-009', 'n16-500-canvas');
      });

      await step('14-B-018', 'apply when N16 failed to load → "Chưa nạp dữ liệu không gian của tầng này, nên chưa áp được tỷ lệ."', async () => {
        const from = sent.length;
        await apply(page).click();
        await expect.soft(panelOf(page).getByText(SCALE.noSpatial, { exact: true })).toBeVisible();
        await flush(page);
        expect.soft(putsSince(sent, from, projectId, floorId), 'no PUT without a level').toHaveLength(0);
        await evidence(page, '14-B-018', 'apply-without-n16');
      });

      await step('14-G-010', 'project settings (N5 confidence threshold) failure → the default 0,70 is used, no visible change', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.settings, onGet((route) => route.abort('failed')));
        await openScale(page, projectId, floorId); // USC:593, SCG:370 — the screen opens as usual
        await expect.soft(noticeOf(page).getByRole('alert'), 'only the warped notice').toHaveCount(1);
        await evidence(page, '14-G-010', 'settings-abort');
      });

      await step('14-B-019', 'all floors: the floor list read fails → "Không tải được danh sách tầng để áp tỉ lệ."', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.floors, onGet((route) => fulfillError(route, 500, 'INTERNAL_ERROR')));
        await openScale(page, projectId, floorId);
        await scopeRadio(page, SCALE.allFloors).click();
        await drawStandard(page);
        await apply(page).click();
        await expect.soft(panelOf(page).getByText(SCALE.listFailed, { exact: true })).toBeVisible({ timeout: 30_000 });
        await expect.soft(page.getByRole('dialog')).toHaveCount(0);
        await evidence(page, '14-B-019', 'list-fails');
      });

      await step('14-G-012', 'all floors: #12 or N15 5xx → "Không tải được danh sách tầng để áp tỉ lệ."', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await page.route(re.graph, onGet((route) => fulfillError(route, 503, 'SERVICE_UNAVAILABLE')));
        await openScale(page, projectId, floorId);
        await scopeRadio(page, SCALE.allFloors).click();
        await drawStandard(page);
        await apply(page).click();
        await expect.soft(panelOf(page).getByText(SCALE.listFailed, { exact: true })).toBeVisible({ timeout: 30_000 }); // USC:1125-1128
        await evidence(page, '14-G-012', 'graph-5xx');
      });

      await step('14-G-018', 'PUT 500 / network → the failure notice and no automatic retry for a scale-only body', async () => {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        const puts: string[] = [];
        let mode: 'http' | 'abort' = 'http';
        await page.route(re.layer, async (route) => {
          if (route.request().method() !== 'PUT') return route.fallback();
          puts.push(mode);
          return mode === 'http' ? fulfillError(route, 500, 'INTERNAL_ERROR') : route.abort('failed');
        });
        await openScale(page, projectId, floorId);
        await drawStandard(page);
        await apply(page).click();
        await expect(panelOf(page).getByText(new RegExp(`^${SCALE.failed} ${ERR.unknown.replace(/\./gu, '\\.')}`, 'u'))).toBeVisible();
        await flush(page);
        expect.soft(puts, 'one PUT, no retry (SLS:394-402, UAS:589-600)').toEqual(['http']);
        await evidence(page, '14-G-018', 'put-500');
        mode = 'abort';
        await applyBtn(page).click();
        await expect.soft(panelOf(page).getByText(new RegExp(`^${SCALE.failed} ${ERR.network.replace(/\./gu, '\\.')}`, 'u'))).toBeVisible();
        await flush(page);
        expect.soft(puts, 'the network failure is not retried either').toEqual(['http', 'abort']);
      });
    } finally {
      await closeSession(s);
    }
  });
});

/** Mutable note shared by two steps (the request index at the 500 load). */
const note500 = { from: 0 };
