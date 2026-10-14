
/**
 * Phase 4 — SCR-16 walls, EDGE layer, MOCKED RESPONSES: two sequential flows (QA-04c P1, `flow-plan.md`
 * "phase04_walls_mocked_edge.spec.ts"): FL-16-M1 (reads: held / 500 / abort / refetch error / background / settings) and
 * FL-16-M2 (saves: reload read fails, 422 integrity / baseVersion, 500, 401 refresh, 503, retry ladder, unresolvable wall).
 * One `test.step('[<row id>] …')` per catalog row, in the planned order; `H` rows use a hard `expect`.
 *
 * Why mocked: a 5xx / aborted / 503 answer cannot be produced on the shared stack. What stays real: the project, its Q1
 * layer, N16, the #35 write when it is not mocked, auth. Each mock is a `page.route` handler with a mode switch; a held
 * response is a promise released after the shot (no timer in a route). Time (the 5 / 15 / 45 s retry ladder) is moved with
 * `page.clock`, never waited. Pairing: BE4-G-206 (corrupt document → 500, pytest) and the A4 reads / versioning flows
 * (`FL-A4-02`, `FL-A4-04`).
 *
 * Source (FE `F:/App/AppFront/src`): see `phase04_walls_edge.spec.ts`; plus FLRF src/screens/qc/shared/floorLayerReadFailure.ts,
 * SLS src/lib/autosave/spatialLayerSave.ts (classifyLayerSaveError, LAYER_SAVE_MESSAGES), CA src/lib/autosave/createAutosave.ts
 * (retry ladder 5 / 15 / 45 s), RS src/lib/autosave/retrySchedule.ts, I18N src/i18n/vi.json (`errors.*`, `floorLayerSave.*`).
 *
 * Request budget per full run: 2 logins (API + browser) per flow, 2 `POST /api/projects`, N16 GET ×(2..12), #35 PUT ×(≈ 14);
 * no upload. Mocks are installed per page and only on `**​/api/projects/**`.
 */
import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { waitForApi } from '../../e2e/fullstack/apiWatch';
import {
  WALL,
  adminClient,
  approveButton,
  asRecord,
  asRecords,
  canvasFrame,
  closeWallsRun,
  ev,
  freezeClock,
  inspector,
  layerRe,
  openWalls,
  openWallsRun,
  putsSince,
  quiet,
  rail,
  rowLabels,
  secondWriter,
  seedQc,
  selectRow,
  statusBar,
  thickenFirst,
  tick,
  toggleCheckbox,
  waitForLayerPut,
  wallOption,
  wallRows,
  type Json,
  type WallsRun,
} from './support/p04/P1';
import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson } from './support/evidence';
import { spaGo } from './support/p03/P11';
import { deleteSeededProject } from './support/phase03Seed';

/** Alerts of the screen itself: the app announcer keeps a hidden `role="alert"` region once it announced (announcer.ts:55). */
const screenAlerts = (page: Page): Locator => page.getByRole('alert').and(page.locator(':not([data-announcer])'));
const UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // vi.json errors.unknown.description
const NETWORK = 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.'; // vi.json errors.network (FLRF:73-75)

/** One answer for a mocked call: JSON error envelope `{ code, message, requestId, ...extra }` (what readWireError reads). */
const wire = (status: number, code: string, extra: Json = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ code, message: `qa mocked ${code}`, requestId: `qa-${code.toLowerCase()}`, ...extra }),
});

type ReadMode = 'real' | 'hold' | '500' | 'abort' | 'wall-thickness-700';
type WriteMode = 'real' | { readonly status: number; readonly code: string; readonly extra?: Json } | 'abort';

/**
 * The page's mocks, switched by assignment. `layerRead`: N16 GET; `background`: the floor read (`…/spatial`, #33);
 * `settings`: `…/settings`; `write`: #35 PUT, with `writeOnce` answering only the first PUT and then going real.
 */
function mockWalls(page: Page, projectId: string, floorId: string) {
  const state = {
    layerRead: 'real' as ReadMode,
    background: 'real' as 'real' | '500',
    settings: 'real' as 'real' | '500',
    write: 'real' as WriteMode,
    writeOnce: false,
    gate: Promise.resolve(),
    reads: 0,
    writes: 0,
  };
  const layerPath = layerRe(projectId, floorId);
  const backgroundPath = new RegExp(`^/api/projects/${projectId}/floors/${floorId}/spatial$`, 'u');
  const settingsPath = new RegExp(`^/api/projects/${projectId}/settings$`, 'u');
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && layerPath.test(path)) {
      state.reads += 1;
      if (state.layerRead === 'hold') await state.gate;
      if (state.layerRead === '500') return route.fulfill(wire(500, 'INTERNAL_ERROR'));
      if (state.layerRead === 'abort') return route.abort('failed');
      if (state.layerRead === 'wall-thickness-700') {
        const response = await route.fetch();
        const doc = asRecord(await response.json(), 'N16');
        const layer = asRecord(doc.layer, 'N16.layer');
        const walls = asRecords(layer.walls, 'walls').map((wall) => ({ ...wall, thicknessMm: 700 }));
        return route.fulfill({ response, json: { ...doc, layer: { ...layer, walls } } });
      }
      return route.fallback();
    }
    if (request.method() === 'GET' && backgroundPath.test(path) && state.background === '500') return route.fulfill(wire(500, 'INTERNAL_ERROR'));
    if (request.method() === 'GET' && settingsPath.test(path) && state.settings === '500') return route.fulfill(wire(500, 'INTERNAL_ERROR'));
    if (request.method() === 'PUT' && layerPath.test(path) && state.write !== 'real') {
      state.writes += 1;
      const answer = state.write;
      if (state.writeOnce) state.write = 'real';
      if (answer === 'abort') return route.abort('failed');
      if (typeof answer === 'object') return route.fulfill(wire(answer.status, answer.code, answer.extra ?? {}));
    }
    return route.fallback();
  };
  return { state, install: (): Promise<void> => page.route('**/api/projects/**', handler), release: (): Promise<void> => page.unroute('**/api/projects/**', handler) };
}

test.describe('E04 SCR-16 walls — mocked-response flows (QA-04c P1)', () => {
  test('SCR-16 · FL-16-M1 · [mocked response] first read held / 500 / retry / abort, refetch error, background and settings failures', async ({ browser }) => {
    test.setTimeout(240_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-m1');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      run = await openWallsRun(browser);
      const { page } = run;
      const mock = mockWalls(page, q1.projectId, floor.id);
      await mock.install();
      const m = mock.state;
      const failure = page.getByRole('alert').filter({ hasText: UNKNOWN });

      await test.step('[16-B-001] Loading: canvas skeleton, 12 table-row skeletons in role status "Danh sách đoạn tường", legend skeleton', async () => {
        m.layerRead = 'hold';
        let release = (): void => undefined;
        m.gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const nav = page.goto(`/projects/${q1.projectId}/floors/${floor.id}/layers/walls`, { waitUntil: 'commit' });
        const list = page.getByRole('status', { name: WALL.list, exact: true });
        await expect(list).toBeVisible();
        await expect.soft(list.locator(':scope > *')).toHaveCount(12);
        await expect.soft(canvasFrame(page).locator('.animate-pulse').first()).toBeVisible();
        await expect.soft(page.locator('[aria-busy="true"][aria-label="Đang tải chú giải"]')).toBeVisible();
        await ev(page, '16-B-001', 'loading-skeleton');
        release();
        await nav;
        await expect(wallRows(page)).toHaveCount(q1.walls.length);
        m.layerRead = 'real';
      });

      await test.step('[16-B-005] First N16 read fails 500: whole-screen read failure with "Thử lại", no tool rail', async () => {
        m.layerRead = '500';
        await page.goto(`/projects/${q1.projectId}/floors/${floor.id}/layers/walls`);
        await expect(failure).toBeVisible({ timeout: 30_000 }); // the GET ladder 300 / 900 / 2700 ms runs first
        await expect.soft(failure.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
        await expect.soft(rail(page)).toHaveCount(0);
        await ev(page, '16-B-005', 'read-500');
      });

      await test.step('[16-B-006] "Thử lại" on the read failure refetches N16 and recovers', async () => {
        m.layerRead = 'real';
        const before = m.reads;
        await failure.getByRole('button', { name: 'Thử lại', exact: true }).click();
        await expect(wallRows(page)).toHaveCount(q1.walls.length);
        expect.soft(m.reads - before, 'GETs after "Thử lại"').toBeGreaterThanOrEqual(1);
        await ev(page, '16-B-006', 'retry-recovers');
      });

      await test.step('[16-B-010] A network abort on the first N16 read: the network sentence + "Thử lại"', async () => {
        m.layerRead = 'abort';
        await page.goto(`/projects/${q1.projectId}/floors/${floor.id}/layers/walls`);
        const offline = page.getByRole('alert').filter({ hasText: NETWORK });
        await expect(offline).toBeVisible({ timeout: 30_000 });
        await expect.soft(offline.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
        await ev(page, '16-B-010', 'read-abort');
        m.layerRead = 'real';
      });

      await test.step('[16-B-011] N16 refetch fails after data: violation alert in the left panel, list emptied, canvas keeps the walls', async () => {
        await openWalls(page, q1.projectId, floor.id);
        await expect(wallRows(page)).toHaveCount(q1.walls.length);
        // An edit does not invalidate layer.byFloor (invalidation.ts editWall), so force the refetch: past the 30 s staleTime,
        // leave SCR-16 (SPA, cache kept) and come back; the remount refetches while the read answers 500.
        m.layerRead = '500';
        await page.clock.runFor(31_000);
        await spaGo(page, ROUTES.project.pipeline(q1.projectId));
        // spaGo returns once pushState moved the URL, not once the router committed the hop (react-router keeps its own location):
        // a second hop at once cancels the pending one and SCR-16 never unmounts, so nothing refetches. Wait for the unmount.
        await expect(wallRows(page)).toHaveCount(0);
        // The screens SCR-16 hops through may read/refresh layer.byFloor themselves (ProcessingScreen does), which restarts the 30 s
        // staleTime: age the cache again on the page we hop from, so the remount of SCR-16 is stale whatever the hop touched.
        // useFloorLayer.test.ts 'QA p04 FL-16-M1' proves the app refetches on remount once stale.
        await page.clock.runFor(31_000);
        const reads0 = m.reads; // tells a missing refetch (app/cache) from a missing error surface
        await spaGo(page, ROUTES.project.walls(q1.projectId, floor.id));
        await expect.poll(() => m.reads - reads0, { message: 'N16 is refetched after the SPA hop back', timeout: 15_000 }).toBeGreaterThanOrEqual(1);
        const panel = page.locator('div').filter({ has: page.getByRole('listbox', { name: WALL.list }) }).first();
        await expect.soft(page.getByText(UNKNOWN, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
        await expect.soft(wallRows(page), 'rows = [] while the error shows').toHaveCount(0);
        await expect.soft(canvasFrame(page).locator('g[aria-label]'), 'the canvas keeps the walls').toHaveCount(q1.walls.length);
        void panel;
        await ev(page, '16-B-011', 'refetch-error');
        m.layerRead = 'real';
      });

      await test.step('[16-B-012] Background #33 read fails: canvas without image, list and editing work, no message', async () => {
        m.background = '500';
        await openWalls(page, q1.projectId, floor.id);
        await expect(wallRows(page)).toHaveCount(q1.walls.length);
        await expect.soft(screenAlerts(page)).toHaveCount(0);
        await expect.soft(canvasFrame(page).locator('img')).toHaveCount(0);
        await selectRow(page, q1.codes.get(String(q1.walls[1]?.id)) as string);
        const put = waitForLayerPut(page, q1.projectId, floor.id);
        await page.keyboard.press('3');
        expect.soft((await put).response.status(), 'editing still saves').toBe(200);
        await ev(page, '16-B-012', 'background-failure');
        m.background = 'real';
      });

      await test.step('[16-C-002] Settings read fails: the default 0,70 applies, no message', async () => {
        m.settings = '500';
        await openWalls(page, q1.projectId, floor.id);
        await toggleCheckbox(page, WALL.onlyLow);
        await expect(wallRows(page)).toHaveCount(1); // Q1 holds one wall below 0.70 (confidence 0.5)
        await expect.soft(screenAlerts(page)).toHaveCount(0);
        await ev(page, '16-C-002', 'settings-failure-default-threshold');
        m.settings = 'real';
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-M2 · [mocked response] save failures: reload read fails, 422 integrity / baseVersion, 500, 401 refresh, 503, retry ladder, unresolvable wall', async ({ browser }) => {
    test.setTimeout(300_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-m2');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      run = await openWallsRun(browser, { acceptDialogs: true });
      const { page } = run;
      const mock = mockWalls(page, q1.projectId, floor.id);
      await mock.install();
      const m = mock.state;
      const code = (n: number): string => q1.codes.get(String(q1.walls[n]?.id)) as string;
      const alertWith = (text: string) => page.getByRole('alert').filter({ hasText: text });
      /** Fresh load, select wall `n`; the caller then edits. */
      const fresh = async (n: number): Promise<void> => {
        await openWalls(page, q1.projectId, floor.id);
        await selectRow(page, code(n));
      };

      await test.step('[16-B-022] The reload read fails: the banner text becomes "Không tải lại được tầng này. Thử lại sau."', async () => {
        await fresh(1);
        await secondWriter(api, q1.projectId, floor.id, thickenFirst); // a real second writer: our save is a 409
        const conflict = waitForApi(page, 'PUT', layerRe(q1.projectId, floor.id), [409]);
        await approveButton(page).click();
        await conflict;
        const banner = alertWith(WALL.conflict);
        await expect(banner).toBeVisible();
        await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
        m.layerRead = '500';
        await page.getByRole('dialog', { name: WALL.confirmTitle, exact: true }).getByRole('button', { name: WALL.confirmReload, exact: true }).click();
        await expect(alertWith('Không tải lại được tầng này. Thử lại sau.')).toBeVisible({ timeout: 30_000 });
        await ev(page, '16-B-022', 'reload-read-fails');
        m.layerRead = 'real';
      });

      await test.step('[16-B-025] PUT 422 LAYER_INTEGRITY_BROKEN: "Tầng này có {count} chỗ hỏng liên kết hình học nên chưa lưu được."', async () => {
        await fresh(2);
        m.write = { status: 422, code: 'LAYER_INTEGRITY_BROKEN', extra: { count: 2 } };
        await page.keyboard.press('3');
        await expect.soft(alertWith('Tầng này có 2 chỗ hỏng liên kết hình học nên chưa lưu được.')).toBeVisible();
        await ev(page, '16-B-025', 'integrity-broken');
        m.write = 'real';
      });

      await test.step('[16-B-026] PUT 422 on field baseVersion behaves like 409: the reload banner', async () => {
        await fresh(3);
        m.write = { status: 422, code: 'VALIDATION', extra: { field: 'baseVersion' } };
        await page.keyboard.press('3');
        await expect.soft(alertWith(WALL.conflict)).toBeVisible();
        await expect.soft(alertWith(WALL.conflict).getByRole('button', { name: WALL.reload, exact: true })).toBeVisible();
        await ev(page, '16-B-026', 'basever-422-reload');
        m.write = 'real';
      });

      await test.step('[16-B-027] PUT 500 blocks until the next edit: banner + failed label; the next edit sends again', async () => {
        await fresh(4);
        m.write = { status: 500, code: 'INTERNAL_ERROR' };
        await page.keyboard.press('3');
        await expect.soft(alertWith('Không lưu được thay đổi của tầng này.')).toBeVisible();
        await expect.soft(statusBar(page)).toContainText('Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.');
        await ev(page, '16-B-027', 'put-500-blocked');
        m.write = 'real';
        const mark = run!.puts.length;
        const retried = waitForLayerPut(page, q1.projectId, floor.id);
        await page.keyboard.press('1'); // the next edit
        expect.soft((await retried).response.status(), 'the next edit sends again').toBe(200);
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'one PUT for the next edit').toHaveLength(1);
      });

      await test.step('[16-G-013] PUT 401 with a live session: refresh and retry, no banner', async () => {
        await fresh(5);
        m.write = { status: 401, code: 'UNAUTHENTICATED' };
        m.writeOnce = true;
        const refresh = page.waitForRequest((request) => request.url().endsWith('/api/auth/refresh'));
        const saved = waitForApi(page, 'PUT', layerRe(q1.projectId, floor.id), [200]);
        await page.keyboard.press('3');
        await refresh;
        expect((await saved).response.status()).toBe(200);
        await expect.soft(screenAlerts(page)).toHaveCount(0);
        await ev(page, '16-G-013', 'put-401-refresh-retry');
        m.writeOnce = false;
        m.write = 'real';
      });

      await test.step('[16-G-012] 503 DEPENDENCY_UNAVAILABLE: the front end retries', async () => {
        await fresh(6);
        const writes0 = m.writes; // counter is cumulative over earlier steps
        await freezeClock(page);
        m.write = { status: 503, code: 'DEPENDENCY_UNAVAILABLE' };
        m.writeOnce = true;
        await page.keyboard.press('3');
        await page.clock.runFor(900);
        await expect.poll(() => m.writes - writes0, { message: 'first PUT answered 503' }).toBe(1);
        await expect.soft(statusBar(page)).toContainText('Có thay đổi chờ đồng bộ');
        // A screenshot hangs while page.clock is paused (qa-flow-author trap): let time run in real time, shoot while the
        // first rung (5 s, RS:1) is still pending, then wait for the retry itself.
        const second = waitForLayerPut(page, q1.projectId, floor.id);
        const resumedAt = Date.now();
        await page.clock.resume();
        await ev(page, '16-G-012', 'put-503-pending');
        expect.soft((await second).response.status(), 'the retry reaches the real server').toBe(200);
        expect.soft(Date.now() - resumedAt, 'the retry waits for the first rung (5 s)').toBeGreaterThan(3_000);
        m.writeOnce = false;
        m.write = 'real';
      });

      await test.step('[16-C-008] A wall the geometry cannot resolve (thickness outside 60–600): no shapes, the list still lists every wall', async () => {
        m.layerRead = 'wall-thickness-700';
        await openWalls(page, q1.projectId, floor.id);
        await expect.soft(wallRows(page)).toHaveCount(q1.walls.length);
        await expect.soft(canvasFrame(page).locator('g[aria-label]')).toHaveCount(0);
        await expect.soft(page.getByRole('region', { name: WALL.screen, exact: true })).toBeVisible(); // not blank
        await ev(page, '16-C-008', 'unresolvable-walls');
        m.layerRead = 'real';
      });

      await test.step('[16-B-028] PUT 503 / network abort is retried at 5 s, 15 s, 45 s: "Có thay đổi chờ đồng bộ" during the retries, then "Lưu thất bại…"; the held body is resent first', async () => {
        await fresh(7);
        await freezeClock(page);
        // Two passes on the same page: 503 DEPENDENCY_UNAVAILABLE, then a network abort. A failed save restarts the ladder at
        // the next edit (CA notifyChange: failed → retryAttempt = 0), so pass 2 needs no navigation.
        const passes = [
          { name: '503', mode: { status: 503, code: 'DEPENDENCY_UNAVAILABLE' } as WriteMode, key: '3' },
          { name: 'abort', mode: 'abort' as WriteMode, key: '1' },
        ];
        const ladder: Json[] = [];
        for (const pass of passes) {
          m.write = pass.mode;
          const mark = run!.puts.length;
          await page.keyboard.press(pass.key);
          await page.clock.runFor(900);
          await expect.poll(() => putsSince(run!, mark).length, { message: `${pass.name} attempt 1` }).toBe(1);
          await expect.soft(statusBar(page)).toContainText('Có thay đổi chờ đồng bộ');
          // RS:1 RETRY_SCHEDULE_MS = [5_000, 15_000, 45_000]
          for (const [rung, wait, label] of [[2, 5_000, 'attempt 2'], [3, 15_000, 'attempt 3'], [4, 45_000, 'attempt 4']] as const) {
            await page.clock.runFor(wait - 100);
            await tick(page);
            expect.soft(putsSince(run!, mark).length, `${pass.name} ${label} not before ${String(wait)} ms`).toBe(rung - 1);
            await page.clock.runFor(200);
            await expect.poll(() => putsSince(run!, mark).length, { message: `${pass.name} ${label}` }).toBe(rung);
            if (rung < 4) await expect.soft(statusBar(page)).toContainText('Có thay đổi chờ đồng bộ');
          }
          await expect.soft(statusBar(page)).toContainText('Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.');
          const sent = putsSince(run!, mark);
          const bodies = sent.map((put) => JSON.stringify({ base: put.baseVersion, walls: put.walls }));
          ladder.push({ pass: pass.name, attempts: sent.length, identicalBodies: new Set(bodies).size === 1 });
          expect.soft(new Set(bodies).size, `${pass.name}: the same body is resent each time`).toBe(1);
        }
        await attachJson('E04_16-B-028_retry-ladder.json', { passes: ladder });
        await ev(page, '16-B-028', 'retry-ladder-failed');
        await page.clock.resume();
        m.write = 'real';
        await quiet(page);
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });
});
