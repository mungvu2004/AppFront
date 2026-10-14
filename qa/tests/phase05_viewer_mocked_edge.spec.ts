/**
 * Phase 5 — SCR-23 Pascal `/projects/:p/3d`, EDGE layer, MOCKED RESPONSES: four flows (QA-05c `flows-C1.md`
 * "phase05_viewer_mocked_edge.spec.ts", rows in `catalog-C1.md`). One `test()` per flow, one `test.step('[<row id>] …')`
 * per row in plan order; H rows hard `expect`, S rows `expect.soft`; evidence `E05_<row id>_<slug>.png`. ⚑ steps assert the
 * CORRECT behaviour and stay red while the bug lives.
 *
 * Every flow title carries `[mocked response]` and its real pair:
 *   FL-23-15 bundle held / aborted (`/assets/pascal/pascal-mount.js*`) — pairs with FL-M-23-01 (real mount, phase05_pipeline);
 *            unpairable on the real stack: a static asset that is slow or lost (network), not an API.
 *   FL-23-16 converter chunk aborted, Pascal sub-chunk aborted, no GPU (init script), `GET /api/feature-flags` override, N15 with
 *            dimensions / notes (#35 cannot write them), POST property-templates 500 — pairs with FL-23-01 / FL-23-06 (edge).
 *   FL-23-17 #24 / N15 500, N15 aborted, N15 delayed, stale-refetch 500 — pairs with FL-23-01 / FL-23-14; 5xx and network loss
 *            are not producible on the shared stack.
 *   FL-23-18 PUT …/spatial/layer 503 / 422 / 400 — pairs with FL-M-23-02 (real PUT 200) / FL-23-09 (real 409).
 * What is real: the project (`layerSeed.createQcProject` → Q1: 1 floor "Tầng 1", qcLayer), #24, N15 (except where mocked),
 * the Pascal bundle (except where held/aborted), auth.
 *
 * Budget per full run: `POST /api/auth/login` 1 admin API (beforeAll) + 4 flow sessions = 5; `POST /api/projects` 4, #35 PUT 4
 * (seeds) + 1 real (FL-23-18 step 2), `DELETE /api/projects/:id` 4; `POST /api/auth/refresh` ≈ 1 per page load (≈ 25 loads).
 * No invitation, no upload.
 */
import { expect, test, type APIRequestContext, type Browser, type Page, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi, type SeededFloor } from './support/layerSeed';
import { spaNavigate } from './support/p03/P9';
import {
  ERROR_PAINT_TIMEOUT_MS,
  PASCAL_BUNDLE_GLOB,
  PASCAL_BUNDLE_PATH,
  PASCAL_RENDER_TIMEOUT_MS,
  RENDERED,
  SAVED_AT,
  SAVE_TIMEOUT_MS,
  T,
  TO_PASCAL_GLOB,
  abortRoute,
  addDimensions,
  addNotes,
  adminWho,
  blurAll,
  canvasBox,
  caption,
  cleanupProjects,
  closeSession,
  disableWebGl,
  fulfillGet,
  holdPascalBundle,
  holdRoute,
  isLayerPut,
  mutateN15,
  openPascal,
  openRoomPanel,
  openSession,
  pascalRoot,
  projectPath,
  renameRoom,
  roomRow,
  saveLine,
  settledCaption,
  skeleton,
  skippedBox,
  spatialPath,
  summary,
  tabTo,
  waitRendered,
  wireError,
  type Session,
} from './support/p05/P2';

let admin: APIRequestContext;
let api: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  api = { request: admin, headers: {} };
});

test.afterAll(async () => {
  await admin?.dispose();
});

/** Own Q1 project + admin browser session; both gone in `finally`. */
async function withQ1(browser: Browser, slug: string, body: (s: Session, floor: SeededFloor) => Promise<void>): Promise<void> {
  const [floor] = await createQcProject(api, slug);
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  let s: Session | undefined;
  try {
    s = await openSession(browser, adminWho());
    await body(s, floor);
  } finally {
    await closeSession(s);
    await cleanupProjects(api, [floor.projectId]);
  }
}

const errorHeading = (page: Page) => page.getByRole('heading', { name: T.errorTitle, exact: true });
const retryButton = (page: Page) => page.getByRole('button', { name: T.retry, exact: true });
const mountRequest = (r: Request): boolean => new URL(r.url()).pathname === PASCAL_BUNDLE_PATH;

test('SCR-23 · FL-23-15 · [mocked response] bundle loading, PASCAL-01, retry URLs — pairs with FL-M-23-01 (real mount)', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 60_000));
  await withQ1(browser, 'v15', async ({ page }, floor) => {
    const pid = floor.projectId;
    const hold = await holdPascalBundle(page);

    await test.step('[23-B-002] bundle held → "Đang nạp khung dựng hình…", canvas box, no summary / save line', async () => {
      await openPascal(page, pid, { wait: false });
      await expect(caption(page)).toHaveText(T.loading);
      await expect(canvasBox(page), 'PV:232-266 the box exists while loading (B-V10 loop guard)').toBeVisible();
      await expect.poll(() => hold.hits.length, { message: 'pascal-mount.js reached the hold' }).toBeGreaterThan(0);
      await expect.soft(summary(page)).toHaveCount(0);
      await expect.soft(saveLine(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23-B-002_bundle-held.png', { caption: `pascal-mount.js held (${String(hold.hits.length)} request)` });
    });

    await test.step('[23-E-004] skeleton is aria-hidden and stops pulsing under reduced motion', async () => {
      await expect.soft(skeleton(page), 'PV:72-74').toHaveAttribute('aria-hidden', 'true');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const animation = await skeleton(page).evaluate((el) => getComputedStyle(el).animationName);
      expect.soft(animation, 'motion-reduce:animate-none').toBe('none');
      await captureEvidence(page, 'E05_23-E-004_skeleton-reduced.png', { caption: `reduced motion: animation-name ${animation}` });
      await page.emulateMedia({ reducedMotion: null });
    });

    const aborted = await abortRoute(page, PASCAL_BUNDLE_GLOB);
    let retryUrl = '';

    await test.step('[23-B-010] reload with the bundle aborted → PASCAL-01 card with "Thử lại"', async () => {
      await hold.dispose();
      await page.reload();
      await expect.soft(errorHeading(page)).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(page.getByText(T.errorText('PASCAL-01'), { exact: true }), 'PV:211').toBeVisible();
      await expect.soft(retryButton(page)).toBeVisible();
      await expect.soft(canvasBox(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23-B-010_pascal-01.png', { caption: `${String(aborted.hits.length)} aborted pascal-mount.js` });
    });

    await test.step('[23-E-015] Tab reaches "Thử lại", Enter retries (new pascal-mount.js request)', async () => {
      await blurAll(page);
      const reached = await tabTo(page, retryButton(page));
      expect.soft(reached, 'PV:213 "Thử lại" is in the Tab order').toBe(true);
      const next = page.waitForRequest(mountRequest, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await page.keyboard.press('Enter');
      retryUrl = (await next).url();
      expect.soft(retryUrl, 'a new bundle request').toContain(PASCAL_BUNDLE_PATH);
      await captureEvidence(page, 'E05_23-E-015_enter-retry.png', { caption: `Enter on "Thử lại" → ${new URL(retryUrl).search}` });
    });

    await test.step('[23-B-011] that request carries attempt=1, still PASCAL-01', async () => {
      expect.soft(new URL(retryUrl).searchParams.get('attempt'), 'UPV:58-73 attempt = failed loads so far').toBe('1');
      await expect.soft(errorHeading(page)).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await captureEvidence(page, 'E05_23-B-011_attempt-1.png', { caption: `retry URL ${new URL(retryUrl).search}` });
    });

    await test.step('[23-B-012] bundle back, R → attempt=2 200, rendered', async () => {
      await aborted.dispose();
      const back = page.waitForResponse((r) => mountRequest(r.request()), { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await page.keyboard.press('r'); // UPV:519-528 R only while failing
      const response = await back;
      expect.soft(new URL(response.url()).searchParams.get('attempt')).toBe('2');
      expect.soft(response.status()).toBe(200);
      await expect.soft(caption(page)).toHaveText(RENDERED, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await captureEvidence(page, 'E05_23-B-012_r-recovers.png', { caption: `R → ${new URL(response.url()).search} → ${String(response.status())}` });
    });
  });
});

test('SCR-23 · FL-23-16 · [mocked response] converter / root failures, no GPU, flag, partial, template 500 — pairs with FL-23-01, FL-23-06', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 90_000));
  await withQ1(browser, 'v16', async ({ context, page }, floor) => {
    const pid = floor.projectId;

    await test.step('[23-B-014] toPascal chunk aborted once → PASCAL-01; "Thử lại" re-runs it (no stuck skeleton)', async () => {
      const once = await abortRoute(page, TO_PASCAL_GLOB, { times: 1 });
      await openPascal(page, pid, { wait: false });
      await expect(page.getByText(T.errorText('PASCAL-01'), { exact: true }), 'UPV:378-391 converter import failed').toBeVisible({
        timeout: PASCAL_RENDER_TIMEOUT_MS,
      });
      let retried = 0;
      const countRetry = (r: Request): void => {
        if (/\/assets\/toPascal-[^/]+\.js$/u.test(new URL(r.url()).pathname)) retried += 1;
      };
      page.on('request', countRetry);
      await retryButton(page).click();
      const settled = await settledCaption(page);
      page.off('request', countRetry);
      // "Thử lại" must re-run the converter load (UPV:377-383 `attempt` in deps): no new request = the browser served the cached
      // failed module, the retry cannot recover → red (soft).
      expect.soft(retried, 'toPascal chunk requested again after "Thử lại"').toBeGreaterThan(0);
      // Accepted branch: Chrome may keep the failed module for that URL (e2e/pascal-viewer.spec.ts:745-751), so the retry can
      // land on PASCAL-01 again — but never stays on "đang nạp" (B-V10-04), and the error keeps its way out.
      expect.soft([T.rendered, T.partial, T.errorCaption], `after "Thử lại": "${settled}"`).toContain(settled);
      if (settled === T.errorCaption) {
        test.info().annotations.push({ type: retried === 0 ? 'bug' : 'branch', description: `23-B-014: retry re-failed (${String(retried)} new toPascal request); not stuck` });
        await expect.soft(retryButton(page)).toBeVisible();
      }
      await captureEvidence(page, 'E05_23-B-014_converter-retry.png', { caption: `${String(once.hits.length)} toPascal chunk aborted; after retry: ${settled}` });
      await once.dispose();
    });

    await test.step('[23-B-015] Pascal sub-chunk aborted after mount → "…kèm mã PASCAL-02."', async () => {
      // UNKNOWN — NEED VERIFICATION: which Pascal sub-chunk loads lazily after mount is not readable from source; the step aborts
      // every NEW `/assets/pascal/*.js` (not the bundle) and opens each Pascal rail panel. If Pascal's own boundary swallows the
      // failure, or nothing loads lazily, the row turns n/a (catalog-C1 23-B-015).
      if ((await caption(page).innerText()) !== T.rendered) await openPascal(page, pid, { text: RENDERED });
      const sub = await abortRoute(page, '**/assets/pascal/**', {
        filter: (r) => new URL(r.url()).pathname.endsWith('.js') && new URL(r.url()).pathname !== PASCAL_BUNDLE_PATH,
      });
      const triggers = pascalRoot(page).locator('[data-slot="tooltip-trigger"]');
      const count = Math.min(await triggers.count(), 12);
      for (let i = 0; i < count; i += 1) {
        if (await triggers.nth(i).isVisible()) await triggers.nth(i).click();
      }
      test.info().annotations.push({ type: 'unknown', description: `23-B-015: ${String(sub.hits.length)} Pascal sub-chunk(s) aborted after mount` });
      await expect.soft(page.getByText(T.errorText('PASCAL-02'), { exact: true }), 'PM:139-143 → UPV:447-450').toBeVisible({ timeout: 10_000 });
      await captureEvidence(page, 'E05_23-B-015_pascal-02.png', { caption: `${String(sub.hits.length)} sub-chunks aborted after mount` });
      await sub.dispose();
    });

    await test.step('[23-B-016] ⚑ no GPU → AppFront card "Máy này chưa dựng được mô hình 3D", "Mã PASCAL-03.", no "Thử lại"', async () => {
      const noGpu = await context.newPage();
      try {
        await disableWebGl(noGpu);
        await openPascal(noGpu, pid, { wait: false });
        const settled = await settledCaption(noGpu, { soft: true });
        // PV:186-200 expected; source today: edit mode never passes onRendererUnavailable (PF:301-321) → Pascal's own card.
        await expect.soft(noGpu.getByRole('heading', { name: T.noGpuTitle, exact: true })).toBeVisible();
        await expect.soft(noGpu.getByText(T.noGpuCode)).toBeVisible();
        await expect.soft(retryButton(noGpu)).toHaveCount(0);
        await captureEvidence(noGpu, 'E05_23-B-016_no-gpu.png', { caption: `WebGL disabled; caption: ${settled}` });
      } finally {
        await noGpu.close();
      }
    });

    await test.step('[26-A-008] feature flag scene.pascal-viewer:false no longer blocks', async () => {
      let flagsServed = 0;
      await page.route('**/api/feature-flags', async (route) => {
        flagsServed += 1;
        const response = await route.fetch();
        const json = (await response.json()) as Record<string, unknown>;
        await route.fulfill({ response, json: { ...json, 'scene.pascal-viewer': false } });
      });
      await openPascal(page, pid, { wait: false });
      await expect.soft(caption(page), 'UPV:556-558 the flag is gone (F-15)').toHaveText(RENDERED, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(page.getByRole('heading', { name: T.forbiddenTitle, exact: true })).toHaveCount(0);
      await attachJson('E05_26-A-008_flag.json', { featureFlagResponsesOverridden: flagsServed });
      await captureEvidence(page, 'E05_26-A-008_flag-off-renders.png', { caption: `GET /api/feature-flags overridden ×${String(flagsServed)} (scene.pascal-viewer:false)` });
      await page.unroute('**/api/feature-flags');
    });

    await test.step('[23-B-006] N15 + 1 dimension → partial: "1 kích thước — …"', async () => {
      const n15 = await mutateN15(page, pid, (graph) => addDimensions(graph, 1));
      await openPascal(page, pid, { wait: false });
      await expect.soft(caption(page), 'UPV:541-571 partial').toHaveText(T.partial, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(skippedBox(page).getByRole('listitem').filter({ hasText: 'kích thước' })).toHaveText(`1 kích thước — ${T.dimensionReason}`);
      await captureEvidence(page, 'E05_23-B-006_partial-dimension.png', { caption: `N15 + 1 dimension (${String(n15.hits)} mocked N15)` });
      await n15.dispose();
    });

    await test.step('[23-B-007] N15 + 3 dimensions + 1 note → one line per kind', async () => {
      const n15 = await mutateN15(page, pid, (graph) => {
        addDimensions(graph, 3);
        addNotes(graph, 1);
      });
      await openPascal(page, pid, { wait: false });
      await expect.soft(caption(page)).toHaveText(T.partial, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      const items = skippedBox(page).getByRole('listitem');
      await expect.soft(items.filter({ hasText: 'kích thước' }), 'UPV:250-264').toHaveText(`3 kích thước — ${T.dimensionReason}`);
      await expect.soft(items.filter({ hasText: 'ghi chú' }), 'TP:661').toHaveText(`1 ghi chú — ${T.noteReason}`);
      await captureEvidence(page, 'E05_23-B-007_partial-grouped.png', { caption: 'N15 + 3 dimensions + 1 note' });
      await n15.dispose();
    });

    await test.step('[23-G-009] POST property-templates 500 on a selected room → "Máy chủ chưa lưu được khuôn mẫu…"', async () => {
      let posts = 0;
      await page.route('**/property-templates*', async (route) => {
        if (route.request().method() !== 'POST') {
          await route.fallback();
          return;
        }
        posts += 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(wireError('INTERNAL')) });
      });
      await openRoomPanel(page);
      await roomRow(page, 'Bếp').click(); // RAP:408 selectRow
      await pascalRoot(page).getByRole('button', { name: T.saveAsTemplate }).click();
      // TPL:23-29 templateFailedReason(kind)
      await expect.soft(
        pascalRoot(page).getByRole('status').filter({ hasText: /^Máy chủ chưa lưu được khuôn mẫu thuộc tính \(.+\)\. Chưa có khuôn nào được tạo\.$/u }),
      ).toBeVisible();
      expect.soft(posts, 'one POST property-templates').toBe(1);
      await captureEvidence(page, 'E05_23-G-009_template-500.png', { caption: `POST …/property-templates → 500 (×${String(posts)})` });
      await page.unroute('**/property-templates*');
    });
  });
});

test('SCR-23 · FL-23-17 · [mocked response] project gate: loading, 500, abort, refresh banner — pairs with FL-23-01 / FL-23-14', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 50_000));
  await withQ1(browser, 'v17', async ({ page }, floor) => {
    const pid = floor.projectId;
    const n15Path = spatialPath(pid);
    const projPath = projectPath(pid);
    const alert = page.getByRole('alert');

    await test.step('[23-B-001] N15 delayed → "Đang nạp khung dựng hình…" + skeleton', async () => {
      const held = await holdRoute(page, `**${n15Path}`, (r) => r.method() === 'GET');
      await openPascal(page, pid, { wait: false });
      await expect(caption(page), 'UPS:135-145 gate loading → screen loading').toHaveText(T.loading);
      await expect(skeleton(page)).toBeVisible();
      await expect.soft(canvasBox(page)).toBeVisible();
      await captureEvidence(page, 'E05_23-B-001_gate-loading.png', { caption: `N15 held (${String(held.hits.length)})` });
      await held.dispose();
      await waitRendered(page);
    });

    await test.step('[23-B-019] #24 500 → "Có trục trặc" + "Thử lại", one <main>', async () => {
      const project500 = await fulfillGet(page, projPath, 500);
      await page.reload();
      await expect.soft(alert.filter({ hasText: T.unknownText }), 'PSG:78-91').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(alert).toContainText(T.unknownTitle);
      await expect.soft(alert.getByRole('button', { name: T.retry, exact: true })).toBeVisible();
      await expect.soft(page.getByRole('main')).toHaveCount(1);
      await captureEvidence(page, 'E05_23-B-019_project-500.png', { caption: `GET ${projPath} → 500 ×${String(project500.hits)}` });
      await project500.dispose();
    });

    await test.step('[23-B-020] N15 500, "Thử lại" refetches N15 only and recovers', async () => {
      const n15 = await fulfillGet(page, n15Path, 500);
      await page.reload();
      await expect(alert.filter({ hasText: T.unknownText })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await n15.dispose();
      const counts = { n15: 0, project: 0 };
      const count = (r: Request): void => {
        if (r.method() !== 'GET') return;
        const path = new URL(r.url()).pathname;
        if (path === n15Path) counts.n15 += 1;
        if (path === projPath) counts.project += 1;
      };
      page.on('request', count);
      await alert.getByRole('button', { name: T.retry, exact: true }).click();
      await expect.soft(caption(page), 'UPS:194-205 retry → success').toHaveText(RENDERED, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      page.off('request', count);
      expect.soft(counts.n15, 'one new N15').toBe(1);
      expect.soft(counts.project, 'no new #24 (UPS:125-127)').toBe(0);
      await captureEvidence(page, 'E05_23-B-020_n15-retry.png', { caption: `after "Thử lại": N15 ×${String(counts.n15)}, #24 ×${String(counts.project)}` });
    });

    await test.step('[23-B-021] N15 aborted → "Mất kết nối"', async () => {
      const lost = await abortRoute(page, `**${n15Path}`, { filter: (r) => r.method() === 'GET' });
      await page.reload();
      await expect.soft(alert.filter({ hasText: T.networkText }), 'vi.json errors.network').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(alert).toContainText(T.networkTitle);
      await captureEvidence(page, 'E05_23-B-021_n15-network.png', { caption: `N15 aborted ×${String(lost.hits.length)}` });
      await lost.dispose();
    });

    await test.step('[23-B-022] stale refetch 500 after leaving to rules and back → "Không tải lại được mô hình.", Pascal stays', async () => {
      await page.reload();
      await waitRendered(page);
      const stale = await fulfillGet(page, n15Path, 500);
      await spaNavigate(page, ROUTES.project.rules(pid));
      await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.rules(pid));
      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.viewer(pid));
      await expect.soft(page.getByText(T.refreshFailed, { exact: true }), 'PSG:93-104 InlineAlert').toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(page.getByRole('button', { name: T.retry, exact: true }).first()).toBeVisible();
      await expect.soft(canvasBox(page), 'the screen stays').toBeVisible();
      await captureEvidence(page, 'E05_23-B-022_refresh-failed.png', { caption: `stale N15 refetch → 500 ×${String(stale.hits)}` });
      await stale.dispose();
    });
  });
});

test('SCR-23 · FL-23-18 · [mocked response] save failures on #35 — pairs with FL-M-23-02 / FL-23-09', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 70_000));
  await withQ1(browser, 'v18', async ({ page }, floor) => {
    await openPascal(page, floor.projectId);
    let current = 'Bếp';
    const answer = async (status: number, body: unknown): Promise<() => Promise<void>> => {
      const handler = async (route: Route): Promise<void> => {
        if (!isLayerPut(route.request())) {
          await route.fallback();
          return;
        }
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      };
      await page.route('**/spatial/layer', handler);
      return () => page.unroute('**/spatial/layer', handler);
    };
    const rename = async (to: string): Promise<void> => {
      await renameRoom(page, current, to);
      current = to;
    };

    await test.step('[23-B-025] PUT 503 → "Lưu thất bại…" + toast "Chưa lưu được thay đổi"', async () => {
      const off = await answer(503, wireError('DEPENDENCY_UNAVAILABLE'));
      await rename('Bếp A');
      await expect(saveLine(page), 'PVC:222-230, USI:64-65').toHaveText(T.saveFailed, { timeout: SAVE_TIMEOUT_MS });
      await expect.soft(page.getByText(T.saveFailedToast, { exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E05_23-B-025_put-503.png', { caption: 'PUT …/spatial/layer → 503 (ladder)' });
      await off();
    });

    await test.step('[23-B-026] next edit after the temporary failure saves (PUT 200, "Đã lưu lúc …")', async () => {
      const put = page.waitForResponse((r) => isLayerPut(r.request()), { timeout: SAVE_TIMEOUT_MS });
      await rename('Bếp B');
      expect.soft((await put).status(), 'SLS:245-251').toBe(200);
      await expect.soft(saveLine(page)).toHaveText(SAVED_AT, { timeout: SAVE_TIMEOUT_MS });
      await captureEvidence(page, 'E05_23-B-026_saved-after-503.png');
    });

    const blocked = async (id: string, slug: string, status: number, body: unknown, to: string, text: string): Promise<void> => {
      const off = await answer(status, body);
      await rename(to);
      await expect.soft(saveLine(page)).toHaveText(text, { timeout: SAVE_TIMEOUT_MS });
      await captureEvidence(page, `E05_${id}_${slug}.png`, { caption: `PUT …/spatial/layer → ${String(status)}` });
      await off();
    };

    await test.step('[23-B-030] PUT 422 issues rooms.0.name → "Tầng 1: Có phòng chưa đặt tên…"', async () => {
      // SLS:100-123 hasUnnamedRoomIssue reads `raw` as zod issues (array) with a path ending in rooms.<n>.name.
      await blocked('23-B-030', 'put-422-unnamed', 422, [{ code: 'too_small', path: ['rooms', 0, 'name'], message: 'qa-05c' }], 'Bếp C',
        'Tầng 1: Có phòng chưa đặt tên nên chưa lưu được tầng này. Đặt tên cho phòng đó rồi lưu lại.');
    });

    await test.step('[23-B-031] PUT 422 LAYER_INTEGRITY_BROKEN count 2 → "Tầng 1: Tầng này có 2 chỗ hỏng…"', async () => {
      await blocked('23-B-031', 'put-422-integrity', 422, wireError('LAYER_INTEGRITY_BROKEN', { count: 2 }), 'Bếp D',
        'Tầng 1: Tầng này có 2 chỗ hỏng liên kết hình học nên chưa lưu được.');
    });

    await test.step('[23-B-032] PUT 400 → "Tầng 1: Không lưu được thay đổi của tầng này."', async () => {
      await blocked('23-B-032', 'put-400', 400, wireError('BAD_REQUEST'), 'Bếp E', 'Tầng 1: Không lưu được thay đổi của tầng này.');
    });
  });
});
