/**
 * Phase 4 — SCR-17 object layer review, EDGE layer, MOCKED RESPONSES: two sequential flows (QA-04c P2, `flow-plan.md`
 * "phase04_objects_mocked_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the
 * planned order, a hard `expect` on the first step, `expect.soft` after; every step captures `E04_<row id>_<slug>.png`.
 * Both titles carry `[mocked response]`.
 *
 * What is mocked and why (support/p04/P2.ts `mockRoute`, answered by test state, never by a timer):
 *   - `GET …/spatial/layer` (N16): 5xx / a dropped connection / 401 / a held response cannot be produced on the shared
 *     stack; a 500 pairs with BE4-G-206/207 (pytest) and the A4 reads flow (FL-A4-02).
 *   - `GET …/spatial` (the background read): the same.
 *   - `PUT …/spatial/layer` (#35): LAYER_INTEGRITY_BROKEN needs a critical integrity break the FE cannot produce, a 422 on
 *     `baseVersion` needs a base above the current revision, 500 / 503 / network are not producible; pairs with
 *     BE4-G-216/217/219 (pytest) and A4 domain rules (FL-A4-06).
 *   `page.clock` (installed, time flowing) only fast-forwards the autosave ladder (5 / 15 / 45 s) of the 503 steps.
 * Everything else is real: the project and its layer, the session, the 409 of [17-B-021] (a real second writer).
 *
 * ## Users and budget
 * Pool admin `p04-p2` (as the edge file) owns the project; the viewer of [17-D-010] is the pool viewer `p04-p2`
 * (`addMember`). Logins: 1 main admin API (beforeAll) + 1 per flow + 1 viewer = 4. `POST /api/projects` 2, refresh ~25.
 */
import { expect, test, type Browser } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson } from './support/evidence';
import { recordAllAnnouncements } from './support/p03/P3';
import {
  OBJ,
  SAVE,
  addMember,
  allOptions,
  approveButton,
  at,
  backgroundRe,
  closeSession,
  deferred,
  ev,
  layerRe,
  mockRoute,
  objectsQ1,
  openObjects,
  openSession,
  openUserContext,
  optionOf,
  pathOf,
  poolUsers,
  screen,
  statusBar,
  toastRegion,
  wireErrorBody,
  writeElsewhere,
  type PoolUser,
  type Session,
} from './support/p04/P2';

let owner: PoolUser;
let viewer: PoolUser;

test.beforeAll(async () => {
  ({ owner, viewer } = await poolUsers());
});

const FLOW_TIMEOUT = 300_000;

async function withFlow(browser: Browser, body: (session: Session) => Promise<void>): Promise<void> {
  const session = await openSession(browser, owner);
  try {
    await body(session);
  } finally {
    await closeSession(session);
  }
}

const putRe = (pid: string, fid: string): RegExp => new RegExp(`^/api/projects/${pid}/floors/${fid}/spatial/layer$`, 'u');
const serverError = { status: 500, body: wireErrorBody('INTERNAL_ERROR') } as const;
const AUTOSAVE_FAILED = 'Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới.'; // vi.json autosave.failed (USI:64-65,132-133)
const UNKNOWN_DESCRIPTION = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // vi.json errors.unknown.description

/* ================================================================= FL-17-M1 */

test('SCR-17 · FL-17-M1 [mocked response] read failures, refetch error, background error, 401, viewer while loading', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page } = s;
    const project = await objectsQ1(s, 'fm1');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const url = ROUTES.project.objects(pid, fid);
    const n16 = await mockRoute(page, layerRe(pid, fid), 'GET');
    const background = await mockRoute(page, backgroundRe(pid, fid), 'GET');
    // ObjectLayerReview.tsx:88-95 left list: four rows; :280-288 the counter card adds four more inside an aria-hidden block (BUG-618) = 8.
    const rowSel = 'div.flex.items-center.gap-4.p-3:has(> .animate-pulse)';
    const skeletonRows = page.locator(`${rowSel}:not([aria-hidden="true"] *)`);
    const allSkeletonRows = page.locator(rowSel);
    const failureScreen = page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Thử lại', exact: true }) });
    let n16At500 = 0; // N16 hits before the 500 load of [17-B-010] (hits() counts every GET since the mock was installed)

    await test.step('[17-B-001] Loading: 4 skeleton rows in the left panel; status bar "Đang đọc lớp đối tượng…" (no fake 0/0); canvas does not say "nothing to draw" yet (BUG-618)', async () => {
      const hold = deferred();
      n16.set({ hold });
      await page.goto(url, { waitUntil: 'commit' });
      await expect(screen(page)).toBeVisible();
      await expect(skeletonRows).toHaveCount(4);
      await expect.soft(allSkeletonRows, 'list 4 + counter card 4').toHaveCount(8);
      // BUG-618: no fake "0/0" while loading; status bar shows LOADING_PROGRESS_LABEL (ObjectLayerReview.tsx:75,348).
      await expect.soft(statusBar(page)).toContainText('Đang đọc lớp đối tượng…');
      await expect.soft(page.getByText('0/0 đối tượng đã duyệt')).toHaveCount(0);
      // BUG-618 (ObjectLayerCanvas.tsx:392, ObjectLayerReview.test.tsx:246): no "nothing to draw" while loading.
      await expect.soft(page.getByText(OBJ.nothingToDraw, { exact: true })).toHaveCount(0);
      await ev(page, '17-B-001', 'loading_skeleton');
      n16.set('pass');
      hold.resolve();
      await expect(statusBar(page)).toContainText('0/3 đối tượng đã duyệt');
      await expect.soft(skeletonRows).toHaveCount(0);
    });

    await test.step('[17-B-010] N16 500 → failure screen with describeError copy ("Có trục trặc" / "Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.") + "Thử lại"', async () => {
      n16.set(serverError);
      n16At500 = n16.hits();
      await page.goto(url);
      await expect(failureScreen).toBeVisible({ timeout: 15_000 }); // a 500 is not auto-retried (retry.ts RETRYABLE_STATUSES = 429/502/503/504)
      await expect.soft(failureScreen.getByRole('heading', { name: 'Có trục trặc', exact: true })).toBeVisible();
      await expect.soft(failureScreen.getByText(UNKNOWN_DESCRIPTION, { exact: true })).toBeVisible();
      await expect.soft(failureScreen.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
      await ev(page, '17-B-010', 'n16_500_failure_screen');
    });

    await test.step('[17-G-006] N16 500 → retry screen', async () => {
      // 500 is not auto-retried (src/lib/http/retry.ts RETRYABLE_STATUSES = 429/502/503/504); the failure screen offers Thử lại.
      expect.soft(n16.hits() - n16At500, 'N16 asked exactly once and answered 500').toBe(1);
      await expect.soft(screen(page), 'the screen is never blank').toBeVisible();
      await expect.soft(page.getByRole('listbox')).toHaveCount(0);
      await ev(page, '17-G-006', 'retry_screen');
    });

    await test.step('[17-B-011] "Thử lại" refetches N16 and the screen recovers', async () => {
      const before = n16.hits();
      n16.set('pass');
      await failureScreen.getByRole('button', { name: 'Thử lại', exact: true }).click();
      await expect(allOptions(page)).toHaveCount(3);
      expect.soft(n16.hits(), 'one more N16 read').toBeGreaterThan(before);
      await expect.soft(failureScreen).toHaveCount(0);
      await ev(page, '17-B-011', 'retry_recovers');
    });

    await test.step('[17-B-012] N16 network abort → "Mất kết nối" / "Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại." + "Thử lại"', async () => {
      n16.set('abort');
      await page.goto(url);
      await expect(failureScreen).toBeVisible({ timeout: 30_000 });
      await expect.soft(failureScreen.getByRole('heading', { name: 'Mất kết nối', exact: true })).toBeVisible();
      await expect.soft(failureScreen.getByText('Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', { exact: true })).toBeVisible();
      await expect.soft(failureScreen.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
      await ev(page, '17-B-012', 'n16_network_failure');
    });

    await test.step('[17-G-007] N16 network failure / timeout → retry screen', async () => {
      await expect.soft(failureScreen.getByRole('button', { name: 'Thử lại', exact: true })).toBeEnabled();
      await expect.soft(screen(page)).toBeVisible();
      await ev(page, '17-G-007', 'network_retry_screen');
    });

    await test.step('[17-B-013] N16 refetch fails AFTER data was shown → no failure screen; left panel "Không tải được lớp đối tượng của tầng.", list emptied, status bar notice', async () => {
      await page.clock.install(); // time flows; fastForward only makes the cached N16 stale (the 30 s tier) without waiting
      n16.set('pass');
      await page.goto(url);
      await expect(allOptions(page)).toHaveCount(3);
      n16.set(serverError); // the re-mount below refetches N16 and gets a 500 while the cached document is still held
      await page.clock.fastForward(40_000);
      const before = n16.hits();
      // Reconnect refetches the stale (> 30 s) N16 query while its cached document is still held.
      await page.evaluate(() => {
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
      });
      await expect.poll(() => n16.hits(), { message: 'N16 refetched', timeout: 10_000 }).toBeGreaterThan(before);
      await expect(page.getByText('Không tải được lớp đối tượng của tầng.').first()).toBeVisible({ timeout: 30_000 });
      await expect.soft(failureScreen, 'no failure screen: the data was already shown').toHaveCount(0);
      await expect.soft(allOptions(page), 'the list is emptied').toHaveCount(0);
      await expect.soft(statusBar(page)).toContainText('Không tải được lớp đối tượng của tầng.');
      await ev(page, '17-B-013', 'refetch_error_after_data');
    });

    await test.step('[17-B-014] Background read (GET …/spatial) fails → canvas without image, no error anywhere, objects still listed', async () => {
      n16.set('pass');
      background.set(serverError);
      const backgroundBefore = background.hits();
      await page.goto(url);
      await expect(allOptions(page)).toHaveCount(3);
      await expect.soft(page.getByRole('alert').filter({ hasText: /\S/u }), 'no error anywhere').toHaveCount(0);
      await expect.soft(page.getByRole('group', { name: OBJ.canvas, exact: true }).locator('img')).toHaveCount(0);
      expect.soft(background.hits() - backgroundBefore, 'the background read was attempted (and answered 500)').toBeGreaterThanOrEqual(1);
      await ev(page, '17-B-014', 'background_500_swallowed');
    });

    await test.step('[17-G-002] Background GET 404/500 → swallowed (no UI error)', async () => {
      background.set({ status: 404, body: wireErrorBody('NOT_FOUND', { resource: 'floor' }) });
      await page.goto(url);
      await expect(allOptions(page)).toHaveCount(3);
      await expect.soft(page.getByRole('alert').filter({ hasText: /\S/u })).toHaveCount(0);
      await expect.soft(statusBar(page)).not.toContainText('Không tải');
      await ev(page, '17-G-002', 'background_404_swallowed');
    });

    await test.step('[17-G-008] N16 401 (session expired) → SessionBootstrap login redirect, no failure screen', async () => {
      background.set('pass');
      n16.set({ status: 401, body: wireErrorBody('UNAUTHENTICATED') });
      await page.goto(url);
      await expect.poll(() => pathOf(page), { timeout: 30_000 }).toBe(ROUTES.login);
      await expect.soft(failureScreen, 'no failure screen').toHaveCount(0);
      await ev(page, '17-G-008', 'n16_401_login_redirect');
      await attachJson('E04_17-G-008_url.json', { url: page.url() });
    });

    await test.step('[17-D-010] ⚑ Viewer while N16 loads: a skeleton is shown (state is forbidden before loading today)', async () => {
      await addMember(s, pid, viewer.email);
      const guest = await openUserContext(browser, viewer);
      try {
        const hold = deferred();
        const viewerN16 = await mockRoute(guest.page, layerRe(pid, fid), 'GET');
        viewerN16.set({ hold });
        await guest.page.goto(url, { waitUntil: 'commit' });
        await expect(screen(guest.page)).toBeVisible();
        const rows = guest.page.locator('div.flex.items-center.gap-4.p-3:has(> .animate-pulse)');
        await expect.soft(rows, 'skeleton rows while N16 loads (OV:84 gates them on state "loading", UO:233-247 returns "forbidden" first)').toHaveCount(4, { timeout: 3_000 });
        await expect.soft(guest.page.getByText(OBJ.emptyGroup, { exact: true }), 'no empty-group text while loading').toHaveCount(0, { timeout: 3_000 });
        await ev(guest.page, '17-D-010', 'viewer_loading');
        viewerN16.set('pass');
        hold.resolve();
        await expect(allOptions(guest.page)).toHaveCount(3);
        await expect.soft(toastRegion(guest.page).getByRole('status')).toHaveCount(0);
      } finally {
        await guest.context.close();
      }
    });
  });
});

/* ================================================================= FL-17-M2 */

test('SCR-17 · FL-17-M2 [mocked response] save failures: reload read, 422 integrity / baseVersion / other, 500, 503 ladder', async ({ browser }) => {
  test.setTimeout(FLOW_TIMEOUT);
  await withFlow(browser, async (s) => {
    const { page } = s;
    const announced = await recordAllAnnouncements(page);
    /** "failed" sentences spoken on the assertive announcer (`[data-announcer="assertive"]`, src/lib/input/announcer.ts:52-58). */
    const failedSpoken = async (): Promise<number> =>
      (await announced()).filter((entry) => entry.urgency === 'assertive' && entry.text === AUTOSAVE_FAILED).length;
    /** Moves the page clock 1 s per poll until the PUT mock saw `count` calls (a retry rung is 5 s, RS:1). */
    const putsReach = (count: number, message: string): Promise<void> =>
      expect
        .poll(
          async () => {
            await page.clock.fastForward(1_000);
            return puts.hits();
          },
          { message, timeout: 30_000 },
        )
        .toBeGreaterThanOrEqual(count);
    const project = await objectsQ1(s, 'fm2');
    const pid = project.projectId;
    const fid = at(project.floors, 0, 'floor').floorId;
    const n16 = await mockRoute(page, layerRe(pid, fid), 'GET');
    const puts = await mockRoute(page, putRe(pid, fid), 'PUT');
    const edit = async (code: string): Promise<void> => {
      await optionOf(page, code).click();
      await approveButton(page).click();
    };
    const banner = (text: string) => page.getByText(text, { exact: true });

    await test.step('[17-B-021] Reload read fails → banner text "Không tải lại được tầng này. Thử lại sau."', async () => {
      await openObjects(page, pid, fid);
      await writeElsewhere(s.api, pid, fid); // a real second writer: the next save is a 409
      await edit('#D-001');
      await expect(banner(SAVE.conflict)).toBeVisible();
      n16.set(serverError);
      await page.getByRole('button', { name: SAVE.reload, exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: SAVE.confirmReload, exact: true }).click();
      await expect(banner(SAVE.reloadFailed)).toBeVisible({ timeout: 30_000 });
      await ev(page, '17-B-021', 'reload_read_failed');
      n16.set('pass');
    });

    await test.step('[17-B-023] Save 422 LAYER_INTEGRITY_BROKEN → "Tầng này có N chỗ hỏng liên kết hình học nên chưa lưu được."', async () => {
      await openObjects(page, pid, fid);
      puts.set({ status: 422, body: wireErrorBody('LAYER_INTEGRITY_BROKEN', { count: 2 }) });
      await edit('#D-001');
      await expect(banner('Tầng này có 2 chỗ hỏng liên kết hình học nên chưa lưu được.')).toBeVisible({ timeout: 20_000 });
      await ev(page, '17-B-023', 'integrity_banner');
    });

    await test.step('[17-G-013] PUT 422 LAYER_INTEGRITY_BROKEN → integrity banner (17-B-023)', async () => {
      const before = puts.hits();
      await edit('#S-001'); // a new edit re-arms the blocked saver (spatialLayerSave.ts: "blocked" waits for a markDirty)
      await expect.poll(() => puts.hits(), { message: 'the second edit is sent too' }).toBeGreaterThan(before);
      await expect.soft(banner('Tầng này có 2 chỗ hỏng liên kết hình học nên chưa lưu được.')).toBeVisible();
      await ev(page, '17-G-013', 'integrity_422_again');
    });

    await test.step('[17-G-012] PUT 422 field baseVersion → reload banner', async () => {
      await openObjects(page, pid, fid);
      puts.set({ status: 422, body: wireErrorBody('VALIDATION', { field: 'baseVersion' }) });
      await edit('#D-001');
      await expect(banner(SAVE.conflict)).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByRole('button', { name: SAVE.reload, exact: true })).toBeVisible();
      await ev(page, '17-G-012', 'base_version_422_reload');
    });

    await test.step('[17-G-014] PUT 422 other code (REVIEW_BY_AI_FORBIDDEN) → "Không lưu được thay đổi của tầng này."', async () => {
      await openObjects(page, pid, fid);
      puts.set({ status: 422, body: wireErrorBody('REVIEW_BY_AI_FORBIDDEN') });
      await edit('#D-001');
      await expect(banner(SAVE.unknown)).toBeVisible({ timeout: 20_000 });
      await expect.soft(page.getByRole('button', { name: SAVE.reload, exact: true })).toHaveCount(0);
      await ev(page, '17-G-014', 'other_422_banner');
    });

    await test.step('[17-B-024] Save 500 → violation banner "Không lưu được thay đổi của tầng này."; next edit retries', async () => {
      await openObjects(page, pid, fid);
      puts.set(serverError);
      await edit('#D-001');
      await expect(banner(SAVE.unknown)).toBeVisible({ timeout: 30_000 });
      const before = puts.hits();
      await edit('#S-001');
      await expect.poll(() => puts.hits(), { message: 'the next edit retries the save', timeout: 30_000 }).toBeGreaterThan(before);
      await ev(page, '17-B-024', 'save_500_banner');
    });

    await test.step('[17-G-017] PUT 500 → blocked banner (17-B-024)', async () => {
      await expect.soft(page.getByRole('alert').filter({ hasText: SAVE.unknown }), 'the blocked banner is an alert').toBeVisible();
      await expect.soft(page.getByRole('button', { name: SAVE.reload, exact: true }), 'a 500 is not a reload case').toHaveCount(0);
      await ev(page, '17-G-017', 'blocked_banner');
    });

    await test.step('[17-B-025] Save 503 / network → silent retry, then assertive announcement "Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới."', async () => {
      await page.clock.install(); // time flows; fastForward only skips the 5 / 15 / 45 s ladder
      await openObjects(page, pid, fid);
      puts.set({ status: 503, body: wireErrorBody('DEPENDENCY_UNAVAILABLE') });
      const before = puts.hits();
      const failedBefore = await failedSpoken();
      await edit('#D-001');
      await putsReach(before + 2, 'the 503 is retried silently (first PUT + the 5 s rung)');
      await expect.soft(page.getByRole('alert').filter({ hasText: SAVE.unknown }), 'no blocking banner while the engine still retries').toHaveCount(0);
      await expect
        .poll(
          async () => {
            await page.clock.fastForward(60_000);
            return failedSpoken();
          },
          { message: 'the assertive "failed" announcement after the ladder', timeout: 90_000, intervals: [400] },
        )
        .toBeGreaterThan(failedBefore);
      await ev(page, '17-B-025', 'save_503_failed');
      await attachJson('E04_17-B-025_announcements.json', { announced: await announced(), putsSeen: puts.hits() });
    });

    await test.step('[17-G-018] PUT 503 / network / timeout → temporary, retried by the engine, then "failed" announcement', async () => {
      await openObjects(page, pid, fid);
      puts.set('abort');
      const before = puts.hits();
      const failedBefore = await failedSpoken();
      await edit('#S-001');
      await putsReach(before + 2, 'a dropped connection is retried (first PUT + the 5 s rung)');
      await expect
        .poll(
          async () => {
            await page.clock.fastForward(60_000);
            return failedSpoken();
          },
          { message: 'an assertive "failed" announcement for the network ladder', timeout: 90_000, intervals: [400] },
        )
        .toBeGreaterThan(failedBefore);
      await ev(page, '17-G-018', 'network_failed');
      puts.set('pass');
    });
  });
});
