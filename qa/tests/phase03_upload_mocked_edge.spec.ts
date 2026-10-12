/**
 * Phase 3 — EDGE, SCR-10 floor upload, [mocked response] flows (QA-03d P6): FL-10-16 … FL-10-19 of
 * `F:/App/AppBack/backend/dieu-phoi/chay/QA-03d/flow-plan.md`. One `test()` per flow, one `test.step('[<row id>] …')`
 * per catalog row, in the user's order. Expected results follow `flow-catalog.md` and the FE source (support/p03/P6.ts
 * cites the files); rows marked "suspected" there assert the catalog's words and carry a `suspected-bug` annotation.
 *
 * Mocks (each flow's title carries "[mocked response]"): `page.route` holds / fakes on `GET /api/projects/:id` (#24),
 * the upload init (#5), chunk (#6), complete (#7) and `POST /api/auth/refresh`; `context.setOffline`. Everything a fake
 * does not cover goes to the real stack.
 *
 * Folded from `phase03_pipeline_edge.spec.ts` (deleted there by the integrator): [U35] → FL-10-16 [10-B-001];
 * [U30] → FL-10-16 [10-A-040]; [U16 U20] → FL-10-17 [10-B-012] + [10-A-020]; [U17] → FL-10-18 [10-A-022];
 * [U32] → FL-10-19 [10-A-043].
 *
 * Real-backend budget per run (QA stack, `qa-limits.override.yml`):
 * - `POST /api/auth/login`: 3 per flow (admin API, pool-owner API, pool-owner browser) → 12 (LOGIN_IP_LIMIT 120 / 60 s).
 * - Parallel-safe (`--workers 4`): every flow signs in as the P6 pool admin `admin:p06` (own slot, never the stored admin
 *   session file), owns its own run-unique project and writes no shared file.
 * - `POST /api/users/invitations`: 0, or 1 the first time the pool slot `admin:p06` is filled (users_invite 30 / 3600 s).
 * - `POST /api/projects`: 4 (one per flow), each deleted in `finally`.
 * - upload init #5 (`drawings_init` per user, 300 / 600 s on the QA stack): pool owner `admin:p06` ≈ FL-10-17 8 +
 *   FL-10-18 8 + FL-10-19 3 = 19 that reach the server (faked / aborted inits never do); FL-10-16 0.
 * - `POST /api/auth/refresh`: 1 per page load; one faked refresh (FL-10-18 last step).
 */
import { expect, test, type Request, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import {
  ERR,
  UP,
  activate,
  assignFromTray,
  badge,
  card,
  cardMenuItems,
  chunkIndexOf,
  chunkRe,
  completeRe,
  fireDrag,
  floorAt,
  floorIds,
  fulfillJson,
  holdRequests,
  initRe,
  logRequests,
  openCardMenu,
  openUpload,
  paddedPng,
  pathname,
  pendingCommandLabels,
  pickFiles,
  pngFile,
  projectReadPath,
  reassignCard,
  recordAllAnnouncements,
  recordProgressLabels,
  removeViaMenu,
  sentSince,
  tray,
  trayItem,
  withPoolOwner,
} from './support/p03/P6';
import { envDrawingPng } from './support/phase03Seed';

const QUIET_MS = 2_500;
const softExpect = expect.configure({ soft: true });
/** Card errors after three attempts with 300 / 900 ms gaps (UT MAX_CHUNK_ATTEMPTS, RETRY_DELAYS_MS). */
const CARD_ERROR_MS = 30_000;
/** A load error after the transport (300/900/2700 ms) and the query layer retries. */
const LOAD_ERROR_MS = 60_000;
const ATTACH_MS = 60_000;

const png = (name: string) => pngFile(name, envDrawingPng());
const isPost = (re: RegExp) => (request: Request): boolean => request.method() === 'POST' && re.test(pathname(request));
const percentLabel = (percent: number, file: string): RegExp => new RegExp(`^Đã tải ${String(percent)}\\s?% của ${file.replace(/\./gu, '\\.')}$`, 'u');

/* ================================================================= FL-10-16 */

test('SCR-10 · FL-10-16 · [mocked response] floor list loading, failing and recovering', async ({ browser }) => {
  test.setTimeout(360_000);
  await withPoolOwner(browser, '10-b-001', 2, async ({ session, project }) => {
    const { page } = session;
    const sent = logRequests(page);
    const readPath = projectReadPath(project.projectId);
    const isRead = (request: Request): boolean => request.method() === 'GET' && pathname(request) === readPath;
    const readMatcher = (url: URL): boolean => url.pathname === readPath;
    /** Every GET of #24 answered by `answer` until unrouted (other methods pass). */
    const fakeRead = async (answer: (route: Route) => Promise<void>): Promise<() => Promise<void>> => {
      const handler = async (route: Route): Promise<void> => (route.request().method() === 'GET' ? answer(route) : route.fallback());
      await page.route(readMatcher, handler);
      return () => page.unroute(readMatcher, handler);
    };
    const loadAlert = page.getByRole('alert').filter({ hasText: UP.loadError });

    const hold = await holdRequests(page, isRead);
    await test.step('[10-B-001] GET held → 3 skeleton rows, drop zone already shown, "0 / 0 tầng đã có bản vẽ"', async () => {
      await page.goto(ROUTES.project.upload(project.projectId));
      await hold.seen();
      // FU SKELETON_ROW_COUNT 3 × Skeleton preset "table-row" (one w-8 block per row).
      await expect(page.locator('.animate-pulse.w-8')).toHaveCount(3);
      await expect(page.getByTestId(UP.dropzone)).toBeVisible();
      await expect(page.getByTestId(UP.counter)).toHaveText('0 / 0 tầng đã có bản vẽ');
      await expect(page.locator('[data-floor-id]')).toHaveCount(0);
      await captureEvidence(page, 'E03_10-B-001_loading.png');
    });

    await test.step('[10-B-040] tang-1.png dropped while held → tray; released → cards, still in the tray, no init', async () => {
      const mark = sent.length;
      await fireDrag(page.getByTestId(UP.dropzone), 'drop', [pngFile('tang-1.png', Buffer.from('qa'))]);
      await expect(trayItem(page, 'tang-1.png')).toBeVisible();
      await hold.release();
      for (const id of floorIds(project)) await expect(card(page, id)).toBeVisible();
      await page.waitForTimeout(QUIET_MS);
      await expect(trayItem(page, 'tang-1.png')).toBeVisible(); // UFU acceptFile: floors were empty → no match
      expect(sentSince(sent, mark, 'POST', initRe(project.projectId)), 'no auto-match, so no init').toHaveLength(0);
      await captureEvidence(page, 'E03_10-B-040_drop_while_loading.png');
    });

    let unroute = await fakeRead((route) => fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p06-mock' }));
    // QA-03e (BUG-509, FIX-2200): a GET 5xx is retryable whatever the ladder did (src/lib/http/client.ts:490-491,
    // retry.ts:30-34), so the load error offers "Thử lại" (useFloorUploadScreen.ts:1285 canRetryLoad).
    await test.step('[10-B-005] GET 500 → title + "Hệ thống đã ghi nhận …" + "Thử lại"; no footer, no drop zone', async () => {
      await page.reload();
      await expect(loadAlert).toBeVisible({ timeout: LOAD_ERROR_MS });
      await expect(loadAlert).toContainText(ERR.unknown);
      await expect.soft(loadAlert.getByRole('button', { name: UP.retry, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: UP.submit, exact: true })).toHaveCount(0);
      await expect(page.getByTestId(UP.dropzone)).toHaveCount(0);
      await captureEvidence(page, 'E03_10-B-005_load_500.png');
    });
    await unroute();

    unroute = await fakeRead((route) => fulfillJson(route, 503, { code: 'SERVICE_UNAVAILABLE', requestId: 'qa-p06-mock' }));
    await test.step('[10-B-006] GET 503 ×4 → "Không tải được danh sách tầng" + "Thử lại"', async () => {
      await page.reload();
      await expect(loadAlert).toBeVisible({ timeout: LOAD_ERROR_MS });
      await captureEvidence(page, 'E03_10-B-006_load_503.png');
      // run-33-P6 (U10-04) had no "Thử lại" here; QA-03e BUG-509 (client.ts:490-491, UFU:1285) restores it.
      await expect.soft(loadAlert.getByRole('button', { name: UP.retry, exact: true }), 'catalog 10-B-006: 503 offers "Thử lại"').toBeVisible({ timeout: 1_000 });
    });

    await test.step('[10-A-040] unrouted, "Thử lại" → refetch on the real backend, cards appear', async () => {
      await unroute();
      let retry = loadAlert.getByRole('button', { name: UP.retry, exact: true });
      if (!(await retry.isVisible())) {
        // The 503 offered no way back (10-B-006 above): reach "Thử lại" through a network error instead.
        test.info().annotations.push({ type: 'note', description: '10-A-040 reached "Thử lại" via an aborted GET: the 503 error had none' });
        const offAbort = await fakeRead((route) => route.abort('failed'));
        await page.reload();
        retry = loadAlert.getByRole('button', { name: UP.retry, exact: true });
        await expect(retry).toBeVisible({ timeout: LOAD_ERROR_MS });
        await offAbort();
      }
      await retry.click();
      for (const id of floorIds(project)) await expect(card(page, id)).toBeVisible();
      await expect(page.getByTestId(UP.dropzone)).toBeVisible();
      await expect(loadAlert).toHaveCount(0);
      await captureEvidence(page, 'E03_10-A-040_retry_loads.png');
    });

    unroute = await fakeRead((route) => route.abort('failed'));
    await test.step('[10-B-007] GET aborted → network sentence + "Thử lại"', async () => {
      await page.reload();
      await expect.soft(loadAlert).toBeVisible({ timeout: LOAD_ERROR_MS });
      await expect.soft(loadAlert).toContainText(ERR.network);
      await expect.soft(loadAlert.getByRole('button', { name: UP.retry, exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_10-B-007_load_network.png');
    });
    await unroute();

    unroute = await fakeRead((route) => fulfillJson(route, 403, { code: 'FORBIDDEN', requestId: 'qa-p06-mock' }));
    await test.step('[10-B-008] GET 403 → forbidden sentence; no "Thử lại"', async () => {
      await page.reload();
      await expect.soft(loadAlert).toBeVisible({ timeout: LOAD_ERROR_MS });
      await expect.soft(loadAlert).toContainText(ERR.forbidden);
      await expect.soft(loadAlert.getByRole('button', { name: UP.retry, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_10-B-008_load_403.png');
    });
    await unroute();

    unroute = await fakeRead(async (route) => {
      const real = await route.fetch();
      const body = (await real.json()) as Record<string, unknown>;
      await fulfillJson(route, 200, { ...body, floors: [{ id: 1, name: null }] });
    });
    await test.step('[10-B-009] GET 200 with a bad floors[] → "Hệ thống đã ghi nhận và sẽ kiểm tra. …"', async () => {
      await page.reload();
      await expect.soft(loadAlert).toBeVisible({ timeout: LOAD_ERROR_MS });
      await expect.soft(loadAlert).toContainText(ERR.unknown);
      await captureEvidence(page, 'E03_10-B-009_load_bad_body.png');
    });
    await unroute();

    unroute = await fakeRead(async (route) => {
      const real = await route.fetch();
      const body = (await real.json()) as { floors?: Record<string, unknown>[] };
      const floors = (body.floors ?? []).map((f) => (f.id === floorAt(project, 0).id ? { ...f, elevationMm: 400_000 } : f));
      await fulfillJson(route, 200, { ...body, floors });
    });
    await test.step('[10-B-038] Tầng 1 at 400 m → submit names "Cao độ vượt giới hạn cho phép (-30 đến 300 mét)."', async () => {
      await page.reload();
      for (const id of floorIds(project)) await expect.soft(card(page, id)).toBeVisible();
      await page.getByRole('button', { name: UP.submit, exact: true }).click();
      // UFU elevationProblemFor (PROJECT_LIMITS -30 … 300 m, formatNumber may print a Unicode minus).
      await expect.soft(page.getByTestId(UP.blockNotice)).toContainText(/Cao độ vượt giới hạn cho phép \([-−]30 đến 300 mét\)\./u);
      await captureEvidence(page, 'E03_10-B-038_elevation_out_of_range.png');
    });
    await unroute();
  });
});

/* ================================================================= FL-10-17 */

test('SCR-10 · FL-10-17 · [mocked response] uploads in flight: four at once, progress, cancel, remove mid-upload, late cancel', async ({ browser }) => {
  test.setTimeout(300_000);
  await withPoolOwner(browser, '10-c-022', 5, async ({ session, project }) => {
    const { page } = session;
    const sent = logRequests(page);
    const labels = await recordProgressLabels(page);
    const pid = project.projectId;
    const [f1, f5] = [floorAt(project, 0), floorAt(project, 4)];
    await openUpload(page, pid, floorIds(project));

    // QA-03e (BUG-532, FIX-2252): floorUploadGateway wraps every task's `start` in one createUploadScheduler
    // (MAX_PARALLEL_UPLOADS = 3), so the 4th init waits for a slot.
    await test.step('[10-C-022] tang-1..tang-4.png auto-matched with inits held → 3 init POSTs in flight (cap 3); released → 4 "Đã gắn kèm"', async () => {
      const hold = await holdRequests(page, isPost(initRe(pid)));
      try {
        await pickFiles(page, [1, 2, 3, 4].map((n) => png(`tang-${String(n)}.png`)));
        await hold.seen(3);
        await page.waitForTimeout(3_000); // a 4th init either joins now or waits for a slot
        const inFlight = hold.held.length;
        await attachJson('E03_10-C-022_inits_in_flight.json', { inFlight });
        await captureEvidence(page, 'E03_10-C-022_four_inits_held.png');
        expect.soft(inFlight, 'at most MAX_PARALLEL_UPLOADS = 3 inits in flight').toBe(3);
      } finally {
        await hold.release();
      }
      for (let i = 0; i < 4; i += 1) await expect(badge(card(page, floorAt(project, i).id), UP.attached)).toBeVisible({ timeout: ATTACH_MS });
    });

    const big = 'ban-ve-lon.png';
    const holdChunk2 = await holdRequests(page, (r) => isPost(chunkRe)(r) && chunkIndexOf(r) === 2);
    await test.step('[10-C-021] 3-chunk ban-ve-lon.png → Tầng 5, chunk 2 held → "Đã tải 33% …" then "Đã tải 66% …"', async () => {
      await pickFiles(page, [paddedPng(big, envDrawingPng(), 11 * 1024 * 1024)]);
      await assignFromTray(page, big, f5.name);
      await holdChunk2.seen();
      const seen = await labels();
      await attachJson('E03_10-C-021_progress_labels.json', { seen });
      expect.soft(seen.some((l) => percentLabel(33, big).test(l)), `33% label among ${JSON.stringify(seen)}`).toBe(true);
      expect.soft(seen.some((l) => percentLabel(66, big).test(l)), `66% label among ${JSON.stringify(seen)}`).toBe(true);
      await captureEvidence(page, 'E03_10-C-021_progress_66.png');
    });

    const card5 = card(page, f5.id);
    await test.step('[10-B-012] badge "Đang tải lên", 2px rail, sr progressbar "Đã tải 66% của ban-ve-lon.png", menu "Huỷ"', async () => {
      await expect(badge(card5, UP.uploading)).toBeVisible();
      const rail = card5.locator('div.absolute.bottom-0[aria-hidden="true"]');
      expect((await rail.boundingBox())?.height, 'FUC ProgressRail h-[2px]').toBe(2);
      await expect(card5.getByRole('progressbar')).toHaveAccessibleName(percentLabel(66, big));
      await openCardMenu(page, f5.id, f5.name);
      await expect(card5.getByRole('button', { name: UP.cancel, exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_10-B-012_uploading_card.png');
      await card5.getByRole('button', { name: `Tuỳ chọn của tầng ${f5.name}`, exact: true }).press('Escape');
    });

    // QA-03e (BUG-533, FIX-2253): FloorUploadCard.tsx:182-184 aria-valuemax=100, aria-valuemin=0, aria-valuenow=percent.
    await test.step('[10-E-009] progressbar has aria-label and aria-valuenow/min/max (0..100)', async () => {
      const bar = card5.getByRole('progressbar');
      const attrs = await bar.evaluate((el) => ({
        label: el.getAttribute('aria-label'),
        now: el.getAttribute('aria-valuenow'),
        min: el.getAttribute('aria-valuemin'),
        max: el.getAttribute('aria-valuemax'),
      }));
      await attachJson('E03_10-E-009_progressbar_attrs.json', attrs);
      expect.soft([attrs.min, attrs.max], 'aria-valuemin / aria-valuemax').toEqual(['0', '100']);
      expect.soft(attrs.now, 'aria-valuenow is the percent').toMatch(/^\d{1,3}$/u);
    });

    await test.step('[10-B-035] "Bắt đầu xử lý" during the upload → "Tầng 5 đang tải lên bản vẽ."', async () => {
      await page.getByRole('button', { name: UP.submit, exact: true }).click();
      await expect.soft(page.getByTestId(UP.blockNotice)).toContainText(`${f5.name} đang tải lên bản vẽ.`);
      await captureEvidence(page, 'E03_10-B-035_submit_while_uploading.png');
    });

    await test.step('[10-A-020] menu "Huỷ" → held chunk aborted, no complete; "Chờ xử lý"; rail gone', async () => {
      const mark = sent.length;
      const held = holdChunk2.held[0];
      const failed = held === undefined ? Promise.resolve(false) : page.waitForEvent('requestfailed', { predicate: (r) => r === held, timeout: 10_000 }).then(() => true, () => false);
      await openCardMenu(page, f5.id, f5.name);
      await activate(card5.getByRole('button', { name: UP.cancel, exact: true }), '"Huỷ" on Tầng 5'); // UFU onCancelUpload → cancelTask
      expect.soft(await failed, 'the held chunk request is aborted').toBe(true);
      await expect(badge(card5, UP.waiting)).toBeVisible();
      await expect(card5.getByRole('progressbar')).toHaveCount(0);
      await expect(card5.locator('div.absolute.bottom-0[aria-hidden="true"]')).toHaveCount(0);
      await page.waitForTimeout(QUIET_MS);
      expect(sentSince(sent, mark, 'POST', completeRe), 'a cancelled upload never completes').toHaveLength(0);
      await captureEvidence(page, 'E03_10-A-020_cancelled.png');
    });
    await holdChunk2.release('abort');

    // QA-03e (BUG-534, FIX-2254): a user's "Huỷ" marks `wasCancelled` → canRetryUpload (useFloorUploadScreen.ts:1170-1173,
    // 1328); the menu renders "Thử lại" before the trash (FloorUploadCard.tsx:134-144).
    await test.step('[10-A-021] after "Huỷ" the menu offers "Thử lại" + "Xoá bản vẽ …"; submit → "Tầng 5 chưa tải xong bản vẽ."', async () => {
      const items = await cardMenuItems(page, f5.id, f5.name);
      expect.soft(items, 'a cancelled upload can be retried').toEqual([UP.retry, `Xoá bản vẽ ${big}`]);
      await page.getByRole('button', { name: UP.submit, exact: true }).click();
      await expect.soft(page.getByTestId(UP.blockNotice)).toContainText(`${f5.name} chưa tải xong bản vẽ.`);
      await captureEvidence(page, 'E03_10-A-021_cancel_dead_end.png');
      await removeViaMenu(page, f5.id, f5.name, big);
    });

    await test.step('[10-A-027] ban-ve-nho.png with chunk 0 held; menu "Xoá" aborts it; "Hoàn tác" → a new init', async () => {
      const small = 'ban-ve-nho.png';
      const holdChunk = await holdRequests(page, isPost(chunkRe), 1);
      const firstInit = page.waitForResponse((r) => isPost(initRe(pid))(r.request()));
      await pickFiles(page, [png(small)]);
      await assignFromTray(page, small, f5.name);
      const firstId = String(((await (await firstInit).json()) as { id?: unknown }).id);
      await holdChunk.seen();
      const held = holdChunk.held[0];
      const failed = held === undefined ? Promise.resolve(false) : page.waitForEvent('requestfailed', { predicate: (r) => r === held, timeout: 10_000 }).then(() => true, () => false);
      await removeViaMenu(page, f5.id, f5.name, small);
      expect.soft(await failed, 'removal aborts the in-flight chunk').toBe(true);
      await holdChunk.release('abort');
      const mark = sent.length;
      const secondInit = page.waitForResponse((r) => isPost(initRe(pid))(r.request()));
      const toast = page.getByRole('status').filter({ hasText: `Đã xoá bản vẽ ${small}` });
      await toast.getByRole('button', { name: UP.undo, exact: true }).click(); // UFU removal ticket undo → startUpload
      const secondId = String(((await (await secondInit).json()) as { id?: unknown }).id);
      expect(sentSince(sent, mark, 'POST', initRe(pid)).length, 'undo re-inits the upload').toBeGreaterThanOrEqual(1);
      // BE uploads.py _twin_upload: an identical init with no chunk within 120 s answers the SAME id — not an FE fault.
      await attachJson('E03_10-A-027_upload_ids.json', { firstId, secondId, sameIdByBeDedupe: firstId === secondId });
      await expect(badge(card5, UP.attached)).toBeVisible({ timeout: ATTACH_MS });
      await captureEvidence(page, 'E03_10-A-027_undo_reinits.png');
      await removeViaMenu(page, f5.id, f5.name, small);
    });

    await test.step('[10-C-024] ban-ve-dua.png → Tầng 5 with its init held, re-assigned to Tầng 1 at once, released → Tầng 1 ends "Đã gắn kèm"', async () => {
      const racy = 'ban-ve-dua.png';
      const holdInit = await holdRequests(page, isPost(initRe(pid)), 1);
      await pickFiles(page, [png(racy)]);
      await assignFromTray(page, racy, f5.name);
      await holdInit.seen();
      await reassignCard(page, f5.id, f1.name); // UFU reassign: cancelTask(first) → startUpload(Tầng 1)
      await expect(card(page, f1.id)).toContainText(racy);
      await holdInit.release();
      await page.waitForTimeout(1_000);
      const card1 = card(page, f1.id);
      await expect.soft(badge(card1, UP.waiting), 'a late "cancelled" of the first task must not reset Tầng 1').toHaveCount(0);
      await expect.soft(badge(card1, UP.attached)).toBeVisible({ timeout: ATTACH_MS });
      await captureEvidence(page, 'E03_10-C-024_late_cancel.png');
    });
  });
});

/* ================================================================= FL-10-18 */

test('SCR-10 · FL-10-18 · [mocked response] init, chunk and complete failures on a card, retry and session loss', async ({ browser }) => {
  test.setTimeout(420_000);
  await withPoolOwner(browser, '10-b-023', 2, async ({ session, project }) => {
    const { page } = session;
    const sent = logRequests(page);
    const pid = project.projectId;
    const [f1, f2] = [floorAt(project, 0), floorAt(project, 1)];
    await page.clock.install(); // timers run in real time; fastForward jumps the request timeouts (timeout.ts)
    await openUpload(page, pid, floorIds(project));

    /** POSTs to `re` answered by `answer` until the returned unroute. */
    const fake = async (re: RegExp, answer: (route: Route) => Promise<void>): Promise<() => Promise<void>> => {
      const matcher = (url: URL): boolean => re.test(url.pathname);
      const handler = async (route: Route): Promise<void> => (route.request().method() === 'POST' ? answer(route) : route.fallback());
      await page.route(matcher, handler);
      return () => page.unroute(matcher, handler);
    };
    const failOn = async (file: string, floor: { id: string; name: string }): Promise<void> => {
      await pickFiles(page, [png(file)]);
      await assignFromTray(page, file, floor.name);
      await expect(badge(card(page, floor.id), UP.error)).toBeVisible({ timeout: CARD_ERROR_MS });
    };
    const alertOf = (floorId: string) => card(page, floorId).getByRole('alert');
    const menuHasRetry = async (floor: { id: string; name: string }): Promise<boolean> =>
      (await cardMenuItems(page, floor.id, floor.name)).includes(UP.retry);
    /** fastForward past a held request's timeout until the card shows an error (each attempt arms its own timer). */
    const outwait = async (floorId: string, stepMs: number): Promise<void> => {
      for (let i = 0; i < 6; i += 1) {
        await page.clock.fastForward(stepMs);
        if (await badge(card(page, floorId), UP.error).waitFor({ timeout: 3_000 }).then(() => true, () => false)) return;
      }
    };

    let unroute = await fake(initRe(pid), (route) => route.abort('failed'));
    await test.step('[10-B-023] init aborted → network sentence + menu "Thử lại"', async () => {
      await failOn('loi-mang.png', f1);
      await expect(alertOf(f1.id)).toContainText(ERR.network);
      expect(await menuHasRetry(f1)).toBe(true);
      await captureEvidence(page, 'E03_10-B-023_init_network.png');
    });

    // QA-03e (BUG-535, FIX-2255/2258/2259): "Đóng" only hides that error (`dismissedProblem`, useFloorUploadScreen.ts:269-274,
    // 1356); the problem and its "Thử lại" stay (UFU:1170-1173).
    await test.step('[10-A-024] "Đóng" on that error → the sentence goes, the menu still offers "Thử lại"; file removed', async () => {
      await alertOf(f1.id).getByRole('button', { name: UP.dismiss, exact: true }).click();
      await expect.soft(alertOf(f1.id)).toHaveCount(0);
      const retryLeft = await menuHasRetry(f1);
      expect.soft(retryLeft, '"Đóng" keeps the retry').toBe(true);
      await captureEvidence(page, 'E03_10-A-024_retry_lost.png');
      await removeViaMenu(page, f1.id, f1.name, 'loi-mang.png');
    });

    await test.step('[10-A-022] init aborted again, unrouted, menu "Thử lại" → new init, chunks from 0 → "Đã gắn kèm"', async () => {
      await failOn('thu-lai.png', f1);
      await unroute();
      const mark = sent.length;
      const complete = page.waitForResponse((r) => isPost(completeRe)(r.request()) && r.status() === 200, { timeout: ATTACH_MS });
      await openCardMenu(page, f1.id, f1.name);
      await activate(card(page, f1.id).getByRole('button', { name: UP.retry, exact: true }), '"Thử lại" on Tầng 1'); // FUC → UFU onRetryUpload
      await complete;
      await expect(badge(card(page, f1.id), UP.attached)).toBeVisible();
      expect(sentSince(sent, mark, 'POST', initRe(pid)), 'one new init').toHaveLength(1);
      expect(sentSince(sent, mark, 'POST', chunkRe).map((s) => chunkIndexOf(s.request))[0], 'chunks start at 0').toBe(0);
      await captureEvidence(page, 'E03_10-A-022_retry_attached.png');
    });

    unroute = await fake(initRe(pid), (route) => fulfillJson(route, 429, { code: 'RATE_LIMITED', requestId: 'qa-p06-mock' }, { 'Retry-After': '1' }));
    await test.step('[10-B-021] init 429 + Retry-After → "Hệ thống đang bận. …" + "Thử lại"', async () => {
      await failOn('ban-ve-429.png', f2);
      await expect.soft(alertOf(f2.id)).toContainText(ERR.rateLimited);
      expect.soft(await menuHasRetry(f2)).toBe(true);
      await captureEvidence(page, 'E03_10-B-021_init_429.png');
      await removeViaMenu(page, f2.id, f2.name, 'ban-ve-429.png');
    });
    await unroute();

    unroute = await fake(initRe(pid), (route) => fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p06-mock' }));
    await test.step('[10-B-022] init 500 → 3 attempts (~300/900 ms gaps) → "Hệ thống đã ghi nhận …"; no "Thử lại"', async () => {
      const mark = sent.length;
      await failOn('ban-ve-500.png', f2);
      const inits = sentSince(sent, mark, 'POST', initRe(pid));
      const gaps = inits.slice(1).map((s, i) => s.at - (inits[i]?.at ?? s.at));
      await attachJson('E03_10-B-022_init_attempts.json', { attempts: inits.length, gapsMs: gaps });
      expect.soft(inits, 'UT MAX_CHUNK_ATTEMPTS 3').toHaveLength(3);
      expect.soft(gaps[0] ?? 0).toBeGreaterThanOrEqual(250);
      expect.soft(gaps[1] ?? 0).toBeGreaterThanOrEqual(800);
      await expect.soft(alertOf(f2.id)).toContainText(ERR.unknown);
      expect.soft(await menuHasRetry(f2)).toBe(false);
      await captureEvidence(page, 'E03_10-B-022_init_500.png');
      await removeViaMenu(page, f2.id, f2.name, 'ban-ve-500.png');
    });
    await unroute();

    await test.step('[10-B-024] init held past the request timeout → "Máy chủ phản hồi quá lâu. …" + "Thử lại"', async () => {
      const hold = await holdRequests(page, isPost(initRe(pid)));
      try {
        await pickFiles(page, [png('ban-ve-cham.png')]);
        await assignFromTray(page, 'ban-ve-cham.png', f2.name);
        await hold.seen();
        await outwait(f2.id, 16_000); // REQUEST_TIMEOUT_MS.default 15 s per attempt
        await expect.soft(badge(card(page, f2.id), UP.error)).toBeVisible();
        await expect.soft(alertOf(f2.id)).toContainText(ERR.timeout);
        expect.soft(await menuHasRetry(f2)).toBe(true);
        await captureEvidence(page, 'E03_10-B-024_init_timeout.png');
      } finally {
        await hold.release('abort');
      }
      await removeViaMenu(page, f2.id, f2.name, 'ban-ve-cham.png');
    });

    unroute = await fake(initRe(pid), (route) => fulfillJson(route, 200, {}));
    await test.step('[10-B-032] init 200 {} → "Hệ thống đã ghi nhận …"; no "Thử lại"', async () => {
      await failOn('ban-ve-rong.png', f2);
      await expect.soft(alertOf(f2.id)).toContainText(ERR.unknown);
      expect.soft(await menuHasRetry(f2)).toBe(false);
      await captureEvidence(page, 'E03_10-B-032_init_empty_body.png');
      await removeViaMenu(page, f2.id, f2.name, 'ban-ve-rong.png');
    });
    await unroute();

    let chunk503 = 0;
    unroute = await fake(chunkRe, async (route) => {
      chunk503 += 1;
      if (chunk503 === 1) await fulfillJson(route, 503, { code: 'SERVICE_UNAVAILABLE', requestId: 'qa-p06-mock' });
      else await route.fallback();
    });
    await test.step('[10-B-025] first chunk 503 once → 2 POSTs for chunkIndex 0, no error, "Đã gắn kèm"', async () => {
      const mark = sent.length;
      await pickFiles(page, [png('ban-ve-503.png')]);
      await assignFromTray(page, 'ban-ve-503.png', f2.name);
      await expect(badge(card(page, f2.id), UP.attached)).toBeVisible({ timeout: ATTACH_MS });
      const zeros = sentSince(sent, mark, 'POST', chunkRe).filter((s) => chunkIndexOf(s.request) === 0);
      expect(zeros, 'chunk 0 retried once').toHaveLength(2);
      await expect(alertOf(f2.id)).toHaveCount(0);
      await captureEvidence(page, 'E03_10-B-025_chunk_503_retried.png');
    });
    await unroute();

    const chunkCase = async (row: string, file: string, slug: string, answer: (route: Route) => Promise<void>, check: (mark: number) => Promise<void>): Promise<void> => {
      const off = await fake(chunkRe, answer);
      await test.step(row, async () => {
        const mark = sent.length;
        await failOn(file, f1);
        await check(mark);
        await captureEvidence(page, `E03_${slug}.png`);
        await removeViaMenu(page, f1.id, f1.name, file);
      });
      await off();
    };

    await chunkCase(
      '[10-B-026] chunk 500 always → 3 attempts, no complete, "Hệ thống đã ghi nhận …"; no "Thử lại"',
      'ban-ve-khuc-500.png',
      '10-B-026_chunk_500',
      (route) => fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p06-mock' }),
      async (mark) => {
        expect.soft(sentSince(sent, mark, 'POST', chunkRe)).toHaveLength(3);
        expect.soft(sentSince(sent, mark, 'POST', completeRe)).toHaveLength(0);
        await expect.soft(alertOf(f1.id)).toContainText(ERR.unknown);
        expect.soft(await menuHasRetry(f1), 'catalog 10-B-026: no "Thử lại" (gap test [U17] said otherwise)').toBe(false);
      },
    );

    await chunkCase(
      '[10-B-027] chunk aborted → network sentence + "Thử lại"; no complete',
      'ban-ve-khuc-mang.png',
      '10-B-027_chunk_network',
      (route) => route.abort('failed'),
      async (mark) => {
        expect.soft(sentSince(sent, mark, 'POST', completeRe)).toHaveLength(0);
        await expect.soft(alertOf(f1.id)).toContainText(ERR.network);
        expect.soft(await menuHasRetry(f1)).toBe(true);
      },
    );

    await chunkCase(
      '[10-B-028] chunk 422 UPLOAD_NOT_RECEIVING → validation sentence, 1 attempt, no "Thử lại"',
      'ban-ve-khuc-422.png',
      '10-B-028_chunk_422',
      (route) => fulfillJson(route, 422, { code: 'UPLOAD_NOT_RECEIVING', requestId: 'qa-p06-mock' }),
      async (mark) => {
        expect.soft(sentSince(sent, mark, 'POST', chunkRe), 'a 422 is terminal (UT TERMINAL_ERROR_KINDS)').toHaveLength(1);
        await expect.soft(alertOf(f1.id)).toContainText(ERR.validation);
        expect.soft(await menuHasRetry(f1)).toBe(false);
      },
    );

    await test.step('[10-B-031] complete 500 → "Hệ thống đã ghi nhận …"; complete held past the file timeout → "Máy chủ phản hồi quá lâu …"', async () => {
      const off = await fake(completeRe, (route) => fulfillJson(route, 500, { code: 'INTERNAL', requestId: 'qa-p06-mock' }));
      await failOn('ban-ve-xong-500.png', f1);
      await expect.soft(alertOf(f1.id)).toContainText(ERR.unknown);
      await captureEvidence(page, 'E03_10-B-031_complete_500.png');
      await removeViaMenu(page, f1.id, f1.name, 'ban-ve-xong-500.png');
      await off();
      const hold = await holdRequests(page, isPost(completeRe));
      try {
        await pickFiles(page, [png('ban-ve-xong-cham.png')]);
        await assignFromTray(page, 'ban-ve-xong-cham.png', f1.name);
        await hold.seen();
        await outwait(f1.id, 61_000); // REQUEST_TIMEOUT_MS.file 60 s per attempt
        await expect.soft(alertOf(f1.id)).toContainText(ERR.timeout);
        await captureEvidence(page, 'E03_10-B-031_complete_timeout.png');
      } finally {
        await hold.release('abort');
      }
      await removeViaMenu(page, f1.id, f1.name, 'ban-ve-xong-cham.png');
    });

    await test.step('[10-B-033] chunk 401 + refresh 401 → "Phiên làm việc đã hết hạn. …" and the session handler runs', async () => {
      await fake(chunkRe, (route) => fulfillJson(route, 401, { code: 'UNAUTHENTICATED', requestId: 'qa-p06-mock' }));
      await page.route('**/api/auth/refresh', (route) => fulfillJson(route, 401, { code: 'UNAUTHENTICATED', requestId: 'qa-p06-mock' }));
      await pickFiles(page, [png('ban-ve-401.png')]);
      await assignFromTray(page, 'ban-ve-401.png', f2.name);
      // run-33-P6: the session handler signs out at once and the guard leaves for /login, so the card sentence is
      // seldom on screen; it is recorded, the sign-out is what the step asserts.
      const sentence = await page.getByText(ERR.unauthenticated).first().waitFor({ timeout: 5_000 }).then(() => true, () => false);
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(ROUTES.login);
      await expect.soft(page.getByText('Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.', { exact: true })).toBeVisible(); // vi.json sessionEnded
      await attachJson('E03_10-B-033_session_handler.json', { cardSentenceSeen: sentence, pathAfter: new URL(page.url()).pathname });
      await captureEvidence(page, 'E03_10-B-033_session_lost.png');
    });
  });
});

/* ================================================================= FL-10-19 */

test('SCR-10 · FL-10-19 · [mocked response] offline: wait for the network, remove, leave, closed tab', async ({ browser }) => {
  test.setTimeout(240_000);
  await withPoolOwner(browser, '10-b-034', 2, async ({ session, project }) => {
    const { context, page } = session;
    const sent = logRequests(page);
    const announced = await recordAllAnnouncements(page);
    const pid = project.projectId;
    const [f1, f2] = [floorAt(project, 0), floorAt(project, 1)];
    const cmd = (file: string): string => `Tải bản vẽ ${file} khi có mạng`; // FUG enqueueOffline label
    await openUpload(page, pid, floorIds(project));

    try {
      await test.step('[10-B-034] offline → banner "Đang làm việc ngoại tuyến"', async () => {
        await context.setOffline(true);
        await expect(page.getByText(UP.offline, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_10-B-034_offline_banner.png');
      });

      await test.step('[10-E-014] two files assigned offline → the await sentence is announced once', async () => {
        await pickFiles(page, [png('ban-ve-1.png'), png('ban-ve-2.png')]);
        await assignFromTray(page, 'ban-ve-1.png', f1.name);
        await assignFromTray(page, 'ban-ve-2.png', f2.name);
        await expect(badge(card(page, f2.id), UP.waiting)).toBeVisible();
        await page.waitForTimeout(1_000);
        const said = (await announced()).filter((t) => t === UP.awaitNetwork);
        expect.soft(said, 'UFU awaitAnnouncedRef: one announcement per outage').toHaveLength(1);
      });

      await test.step('[10-A-044] card menu "Xoá" ban-ve-2.png → its queued command dropped; ban-ve-1 stays', async () => {
        await expect.poll(() => pendingCommandLabels(page)).toEqual(expect.arrayContaining([cmd('ban-ve-1.png'), cmd('ban-ve-2.png')]));
        await removeViaMenu(page, f2.id, f2.name, 'ban-ve-2.png');
        await softExpect.poll(() => pendingCommandLabels(page)).not.toContain(cmd('ban-ve-2.png'));
        expect.soft(await pendingCommandLabels(page)).toContain(cmd('ban-ve-1.png'));
        await captureEvidence(page, 'E03_10-A-044_offline_removed.png');
      });

      await test.step('[10-A-043] Tầng 1 "Chờ xử lý" + await banner + queued command; online → "Đã gắn kèm", command gone', async () => {
        const card1 = card(page, f1.id);
        await expect(badge(card1, UP.waiting)).toBeVisible();
        await expect(page.getByText(UP.awaitNetwork, { exact: true }).first()).toBeVisible();
        expect(await pendingCommandLabels(page)).toContain(cmd('ban-ve-1.png'));
        expect(sentSince(sent, 0, 'POST', initRe(pid)), 'no init while offline').toHaveLength(0);
        await captureEvidence(page, 'E03_10-A-043_offline_waiting.png');
        await context.setOffline(false);
        await expect(badge(card1, UP.attached)).toBeVisible({ timeout: 90_000 }); // UFU resumeAwaiting
        await expect(page.getByText(UP.offline, { exact: true })).toHaveCount(0);
        await expect.poll(() => pendingCommandLabels(page)).not.toContain(cmd('ban-ve-1.png'));
        await captureEvidence(page, 'E03_10-A-043_online_attached.png');
      });

      await test.step('[10-A-046] offline again, ban-ve-3.png → Tầng 2, breadcrumb "Dự án" → command dropped on unmount', async () => {
        await context.setOffline(true);
        await pickFiles(page, [png('ban-ve-3.png')]);
        await assignFromTray(page, 'ban-ve-3.png', f2.name);
        await expect.poll(() => pendingCommandLabels(page)).toContain(cmd('ban-ve-3.png'));
        await page.getByRole('navigation').getByRole('button', { name: UP.breadcrumbProjects, exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.dashboard);
        await softExpect.poll(() => pendingCommandLabels(page)).not.toContain(cmd('ban-ve-3.png'));
        await captureEvidence(page, 'E03_10-A-046_left_offline.png');
      });

      await test.step('[10-A-045] tab 2 queues ban-ve-4.png offline and is closed; online, tab 1 reopens → file gone, orphan cleared', async () => {
        await context.setOffline(false);
        const second = await context.newPage();
        await openUpload(second, pid, floorIds(project));
        await context.setOffline(true);
        await pickFiles(second, [png('ban-ve-4.png')]);
        await assignFromTray(second, 'ban-ve-4.png', f2.name);
        await expect.poll(() => pendingCommandLabels(second)).toContain(cmd('ban-ve-4.png'));
        await second.close(); // no React unmount: the command stays behind as an orphan
        await context.setOffline(false);
        await openUpload(page, pid, floorIds(project));
        await softExpect.poll(() => pendingCommandLabels(page)).not.toContain(cmd('ban-ve-4.png')); // FUG clearOrphanUploads
        await expect.soft(card(page, f2.id)).not.toContainText('ban-ve-4.png');
        await expect.soft(tray(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_10-A-045_orphan_cleared.png');
      });
    } finally {
      await context.setOffline(false);
    }
  });
});
