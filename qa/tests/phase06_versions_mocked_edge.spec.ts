/**
 * Phase 6 (QA-06b P7) — SCR-32 "Lịch sử phiên bản", EDGE layer, MOCKED RESPONSES: five sequential user flows
 * (FL-32-12..FL-32-16 of `flows-C5.md`), one `test()` per flow, one `test.step('[<row id>] …')` per catalog row in the
 * planned order. `H` rows = hard `expect` (open step), the rest `expect.soft`. Evidence `E06v_<row id>_<slug>.png`.
 *
 * Every flow name carries `[mocked response]` and names its real pairing: N17 500/403/404, a hand-built history, a purged
 * or transiently failing N18 and the N19/N20 write errors cannot be produced by a real floor. What stays real: the
 * project and its floor(s), auth, the gate (#24), N15 and N16 (except where a step says it fails N16 on purpose).
 * Mocks live in `support/p06/versionMocks.ts` (`installVersionMocks`): N17..N20 of ONE project, held with promises.
 *
 * Source (FE, master d50bb248; files under src/screens/export/VersionHistory/): VH VersionHistory.tsx · VL VersionList.tsx ·
 * VD VersionLabelDialog.tsx · VC VersionCompare.tsx · VV VersionVisualDiff.tsx · VHC VersionHistory.container.tsx ·
 * UVH useVersionHistory.ts · VHM versionHistoryModel.ts · VHG versionHistoryGateway.ts · VHP versionHistoryCompare.ts.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 admin API (`beforeAll`) + 5 flow sessions (`openFlow`) = 6 (limit 120 / 60 s per IP).
 * - `POST /api/projects` 5 (+ 1 N16 read and, for FL-32-14, 1 #35 layer PUT); `DELETE /api/projects/:id` 5.
 * - No upload init, no pipeline: nothing hits `drawings_init`. Browser refresh ≈ 1 per page load (≈ 90 loads).
 * - Mocked: N17 / N18 / N19 / N20 answers only (never reach the BE).
 * Timers: `page.clock.install()` (time keeps flowing) only in FL-32-15 (15 s request timeout) and FL-32-16 (8 s undo window).
 */
import { expect, test, type APIRequestContext, type Browser, type Page, type Route } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import { createQcProject, deleteProject, type LayerApi } from './support/layerSeed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { createProject } from './support/phase03Seed';
import { readLevelId } from './support/p06/P7';
import {
  VH,
  banner,
  calendarDate,
  deferred,
  diffTab,
  floorSelect,
  heading,
  installVersionMocks,
  listSkeleton,
  ok,
  openVersionsPage,
  pageOf,
  snapshotBody,
  summaryOf,
  toast,
  versionIdOf,
  versionList,
  versionRow,
  wireError,
  type Answer,
  type SummaryInput,
  type VersionMock,
} from './support/p06/versionMocks';

/** react-query retries a failed read once (cachePolicy.ts:79-82) after the HTTP ladder (300+900+2700 ms for a dropped connection). */
const ERROR_PAINT_TIMEOUT_MS = 45_000;
const DAY_MS = 86_400_000;

/* ---------------------------------------------------------------- admin + rig */

let adminApi: APIRequestContext;
let layerApi: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  adminApi = await signedInApi(email, password);
  layerApi = { request: adminApi, headers: {} };
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

interface Rig {
  readonly flow: Flow;
  readonly page: Page;
  readonly mock: VersionMock;
  readonly projectId: string;
  readonly floorId: string;
  readonly floorName: string;
  /** Puts the default N17..N20 handlers back. */
  readonly reset: () => void;
}

/**
 * Project (+ QC layer when `qc`) → signed-in context → version mocks installed before any `goto`. Deleted in `finally`.
 * `qc` gives the current graph a real scene, which the "Trực quan" states need (the bare floor builds none).
 */
async function withRig(
  browser: Browser,
  slug: string,
  body: (rig: Rig) => Promise<void>,
  options: { readonly qc?: boolean; readonly clock?: boolean } = {},
): Promise<void> {
  const seeded =
    options.qc === true
      ? (await createQcProject(layerApi, slug))[0]
      : await createProject(adminApi, slug, 1).then((p) => (p.floors[0] === undefined ? undefined : { projectId: p.projectId, floorId: p.floors[0].id, floorName: p.floors[0].name }));
  if (seeded === undefined) throw new Error('setup: fixture project has no floor');
  const { projectId, floorId, floorName } = seeded;
  let flow: Flow | undefined;
  try {
    flow = await openFlow(browser, readAdminCredentials());
    const { page } = flow;
    if (options.clock === true) await page.clock.install();
    const mock = await installVersionMocks(page, projectId, await readLevelId(layerApi, projectId, floorId));
    const defaults = { list: mock.list, snapshot: mock.snapshot, restore: mock.restore, label: mock.label };
    const reset = (): void => {
      Object.assign(mock, defaults);
    };
    await body({ flow, page, mock, projectId, floorId, floorName, reset });
  } finally {
    if (flow !== undefined) {
      await flow.page.unrouteAll({ behavior: 'ignoreErrors' }); // a held answer must not outlive the page
      await closeFlow(flow);
    }
    const failure = options.qc === true ? await deleteProject(layerApi, projectId) : await deleteSeededProject(adminApi, projectId);
    if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
  }
}

/** Newest-first history; floorRevision 9000+ never equals the real revision, so no row is "Hiện tại" and every row restores. */
const history = (count: number, patch: (sequence: number) => Partial<SummaryInput> = () => ({})): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => count - i).map((sequence) =>
    summaryOf({ sequence, floorRevision: 9_000 + sequence - 1, note: `ghi chú mock v${String(sequence)}`, ...patch(sequence) }),
  );

const restoreButton = (page: Page) => page.getByRole('button', { name: VH.restore, exact: true });
const tagButton = (page: Page) => page.getByRole('button', { name: VH.tag, exact: true });

/** "Phục hồi phiên bản này" → "Phục hồi" in the confirm dialog (VH:195-211). */
async function confirmRestore(page: Page): Promise<void> {
  await expect(restoreButton(page)).toBeEnabled();
  await restoreButton(page).click();
  await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
}

/** Label dialog: opens it, types `text`, submits (VD:416-445). */
async function submitLabel(page: Page, text: string): Promise<void> {
  await expect(tagButton(page)).toBeVisible();
  await tagButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: VH.labelField, exact: true }).fill(text);
  await dialog.getByRole('button', { name: VH.labelSubmit, exact: true }).click();
}

const layerReads = (flow: Flow, since: number): number =>
  flow.sent.slice(since).filter((r) => r.method === 'GET' && /\/floors\/[^/]+\/spatial\/layer$/u.test(r.path)).length;

/* ================================================================= flows */

test.describe('E06 SCR-32 version history — mocked-response flows (QA-06b P7)', () => {
  test('SCR-32 · FL-32-12 · [mocked response] list states: loading, errors, forbidden (real pairing: FL-32-01 empty state, FL-32-03 list)', async ({ browser }) => {
    test.setTimeout(300_000);
    await withRig(browser, 'versions-12', async ({ page, mock, projectId, reset }) => {
      mock.setHistory(history(2));

      await test.step('[32-B-004] versions loading: h1 and "Tầng" Select stay, a table-row skeleton, no list, no error', async () => {
        const gate = deferred();
        mock.list = () => ({ ...ok(pageOf(mock.history)), hold: gate.promise });
        await page.goto(`/projects/${projectId}/versions`);
        await expect(heading(page)).toBeVisible(); // VH:44-46
        await expect.soft(floorSelect(page)).toBeVisible();
        await expect.soft(listSkeleton(page)).toHaveCount(1); // VH:61-68 table-row + property-panel
        await expect.soft(versionList(page)).toHaveCount(0);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await captureEvidence(page, 'E06v_32-B-004_loading.png');
        gate.release();
        await expect(versionList(page)).toBeVisible();
        reset();
      });

      await test.step('[32-B-001] project not yet in the store (GET /projects/:id held): skeleton status "Dự án chưa nạp xong"', async () => {
        const gate = deferred();
        const projectRead = new RegExp(`/api/projects/${projectId}(?:\\?.*)?$`, 'u');
        const hold = async (route: Route): Promise<void> => {
          await gate.promise;
          await route.continue();
        };
        await page.route(projectRead, hold);
        await page.goto(`/projects/${projectId}/versions`);
        // S5-confirm: ProjectSpatialGate may paint its own skeleton before VHC:208-214 gets its turn; if so this status never shows.
        await expect.soft(page.getByRole('status', { name: VH.projectLoading })).toBeVisible();
        await captureEvidence(page, 'E06v_32-B-001_project-loading.png');
        gate.release();
        await expect(heading(page)).toBeVisible();
        await page.unroute(projectRead, hold);
      });

      await test.step('[32-B-007] N17 fails with 500: error alert with a retry action; "Tầng" kept', async () => {
        mock.list = () => wireError(500, 'INTERNAL_ERROR');
        await openVersionsPage(page, projectId);
        await expect.soft(page.getByText(VH.listErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // VH:90-104
        await expect.soft(page.getByText(VH.listErrorReason, { exact: true })).toBeVisible(); // VHG:57
        await expect.soft(page.getByRole('button', { name: VH.retry, exact: true })).toBeVisible();
        await expect.soft(floorSelect(page)).toBeVisible();
        await captureEvidence(page, 'E06v_32-B-007_list-500.png');
      });

      await test.step('[32-A-040] list error "Thử lại" refetches N17 and recovers', async () => {
        const mark = mock.calls.length;
        reset();
        await page.getByRole('button', { name: VH.retry, exact: true }).click(); // VH:98-100
        await expect.poll(() => mock.count('list', mark)).toBe(1);
        await expect.soft(versionRow(page, 'v2')).toBeVisible();
        await expect.soft(page.getByText(VH.listErrorTitle, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E06v_32-A-040_retry-recovered.png');
      });

      await test.step('[32-B-008] network failure on N17 gives the same error state', async () => {
        mock.list = () => ({ abort: true });
        await openVersionsPage(page, projectId);
        await expect.soft(page.getByText(VH.listErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // UVH:485-487
        await expect.soft(page.getByText(VH.listErrorReason, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: VH.retry, exact: true })).toBeVisible();
        await captureEvidence(page, 'E06v_32-B-008_list-network.png');
      });

      await test.step('[32-B-009] N17 403: "Không đủ quyền xem", floor Select hidden', async () => {
        mock.list = () => wireError(403, 'FORBIDDEN');
        await openVersionsPage(page, projectId);
        await expect.soft(page.getByText(VH.forbiddenTitle, { exact: true })).toBeVisible(); // VH:80-88
        await expect.soft(page.getByText(VH.forbiddenText, { exact: true })).toBeVisible();
        await expect.soft(floorSelect(page)).toHaveCount(0); // VH:47
        await captureEvidence(page, 'E06v_32-B-009_forbidden.png');
      });

      await test.step('[32-B-010] N17 404 with resource "project" is also "forbidden"', async () => {
        mock.list = () => wireError(404, 'NOT_FOUND', { resource: 'project' });
        await openVersionsPage(page, projectId);
        await expect.soft(page.getByText(VH.forbiddenTitle, { exact: true })).toBeVisible(); // VHM:485
        await expect.soft(floorSelect(page)).toHaveCount(0);
        await captureEvidence(page, 'E06v_32-B-010_project-404.png');
      });

      await test.step('[32-B-011] N17 404 with resource "floor" is a generic list error', async () => {
        mock.list = () => wireError(404, 'NOT_FOUND', { resource: 'floor' });
        await openVersionsPage(page, projectId);
        await expect.soft(page.getByText(VH.listErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // VHM:485
        await expect.soft(page.getByText(VH.forbiddenTitle, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E06v_32-B-011_floor-404.png');
      });
    });
  });

  test('SCR-32 · FL-32-13 · [mocked response] synthetic history: note fallback, day groups, order, cursor fallback (real pairing: FL-32-03, FL-32-06)', async ({ browser }) => {
    test.setTimeout(240_000);
    await withRig(browser, 'versions-13', async ({ page, mock, projectId }) => {
      // 54 versions: v54..v52 today, v51..v40 two days ago, v39..v1 nine days ago; v53 has no note.
      const all = history(54, (sequence) => ({
        agoMs: sequence >= 52 ? sequence * 1_000 : sequence >= 40 ? 2 * DAY_MS + sequence * 1_000 : 9 * DAY_MS + sequence * 1_000,
        ...(sequence === 54 ? { note: 'phục hồi nội dung của phiên bản v2' } : {}),
      })).map((item) => (item.sequence === 53 ? (({ note: _dropped, ...rest }) => rest)(item) : item));
      mock.setHistory(all);
      const firstPage = all.slice(0, 50);
      const secondPage = [all[49] ?? {}, ...all.slice(50)]; // v5 again: pages must not duplicate a version
      mock.list = (call) => (call.query.cursor === undefined ? ok(pageOf(firstPage, 'qa-cursor-2')) : ok(pageOf(secondPage)));

      await test.step('[32-C-002] row description is the version note, or the fallback when there is none', async () => {
        await openVersionsPage(page, projectId);
        await expect(versionRow(page, 'v54')).toContainText('phục hồi nội dung của phiên bản v2'); // VHM:205
        await expect.soft(versionRow(page, 'v53')).toContainText(VH.noNote);
        await captureEvidence(page, 'E06v_32-C-002_note-fallback.png');
      });

      await test.step('[32-C-005] rows are grouped by calendar day: "Hôm nay", then dd/mm/yyyy', async () => {
        const headings = versionList(page).locator('h3');
        await expect.soft(headings).toHaveText([VH.today, calendarDate(new Date(Date.now() - 2 * DAY_MS)), calendarDate(new Date(Date.now() - 9 * DAY_MS))]); // VHM:237-259
        await expect.soft(versionList(page).locator('div:has(> h3)').first().getByRole('listitem')).toHaveCount(3);
        await captureEvidence(page, 'E06v_32-C-005_day-groups.png');
      });

      await test.step('[32-C-006] order is sequence descending and two pages never duplicate a version', async () => {
        await page.getByRole('button', { name: VH.loadMore, exact: true }).click();
        await expect.poll(() => mock.calls.filter((c) => c.kind === 'list' && c.query.cursor === 'qa-cursor-2').length).toBe(1);
        const expected = Array.from({ length: 54 }, (_, i) => VH.checkbox(`v${String(54 - i)}`));
        await expect.soft(versionList(page).getByRole('checkbox')).toHaveCount(54);
        const names = await versionList(page).getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
        expect.soft(names, 'v54 … v1, each once').toEqual(expected); // UVH:158-167
        await captureEvidence(page, 'E06v_32-C-006_two-pages.png');
      });

      await test.step('[32-C-055] cursor refused by the server (CURSOR_INVALID): the first page is read again, no error', async () => {
        mock.list = (call) => (call.query.cursor === undefined ? ok(pageOf(firstPage, 'qa-cursor-2')) : wireError(422, 'CURSOR_INVALID'));
        await openVersionsPage(page, projectId);
        const mark = mock.calls.length;
        await page.getByRole('button', { name: VH.loadMore, exact: true }).click();
        await expect.poll(() => mock.count('list', mark)).toBe(2); // the refused cursor, then the retry without it (VHG:187-191)
        const lists = mock.calls.slice(mark).filter((c) => c.kind === 'list');
        expect.soft(lists[0]?.query.cursor).toBe('qa-cursor-2');
        expect.soft(lists[1]?.query.cursor).toBeUndefined();
        await expect.soft(versionList(page).getByRole('checkbox')).toHaveCount(50);
        await expect.soft(page.getByText(VH.listErrorTitle, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E06v_32-C-055_cursor-fallback.png');
      });
    });
  });

  test('SCR-32 · FL-32-14 · [mocked response] content sentences, snapshot failures, no WebGL (real pairing: FL-32-06 retention rows, FL-32-11 visual)', async ({ browser }) => {
    test.setTimeout(360_000);
    await withRig(
      browser,
      'versions-14',
      async ({ page, mock, projectId, reset }) => {
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function patched(this: HTMLCanvasElement, ...args: unknown[]) {
            if (/webgl/iu.test(String(args[0])) && sessionStorage.getItem('qa-no-webgl') === '1') return null;
            return Reflect.apply(original, this, args) as never;
          } as typeof original;
          // the Pascal viewer tries WebGPU first: hide navigator.gpu too while the flag is set (as support/p05/viewer.ts disableWebGl)
          const gpu = (navigator as unknown as { gpu?: unknown }).gpu;
          Object.defineProperty(Navigator.prototype, 'gpu', {
            get: () => (sessionStorage.getItem('qa-no-webgl') === '1' ? undefined : gpu),
            configurable: true,
          });
        });
        const baseSnapshot = mock.snapshot;
        const v1 = versionIdOf(1);
        const three = history(3);
        mock.setHistory(three);

        await test.step('[32-B-012] only one version: teaching sentence, no Selects, no tabs', async () => {
          mock.setHistory(history(1));
          await openVersionsPage(page, projectId);
          await expect(page.getByText(VH.teaching, { exact: true })).toBeVisible(); // VHP:348-349
          await expect.soft(page.getByRole('combobox', { name: VH.leftSelect, exact: true })).toHaveCount(0);
          await expect.soft(page.getByRole('tablist', { name: VH.tabs, exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E06v_32-B-012_one-version.png');
        });

        await test.step('[32-B-013] fewer than two versions with content: "not enough content" sentence', async () => {
          mock.setHistory(history(2, (sequence) => ({ hasSnapshot: sequence !== 1 })));
          await openVersionsPage(page, projectId);
          await expect.soft(page.getByText(VH.notEnough, { exact: true })).toBeVisible(); // VHP:355-356
          await expect.soft(versionRow(page, 'v1')).toContainText(VH.retention);
          await captureEvidence(page, 'E06v_32-B-013_not-enough-content.png');
        });

        await test.step('[32-B-014] snapshots still loading and no diff yet: loading sentence', async () => {
          mock.setHistory(three);
          const gate = deferred();
          mock.snapshot = (id, call) => ({ ...baseSnapshot(id, call), hold: gate.promise });
          await openVersionsPage(page, projectId);
          await expect.soft(page.getByText(VH.loadingSentence, { exact: true })).toBeVisible(); // VHP:352
          await captureEvidence(page, 'E06v_32-B-014_loading-sentence.png');
          gate.release();
          await expect(page.getByRole('tablist', { name: VH.tabs, exact: true })).toBeVisible();
          reset();
        });

        // 32-B-018/019 -> n/a on the stack (QA-06 v3 decision 2026-10-15, timeline 09:2xZ): no snapshot the server can send reaches the
        // "unavailable" scene (a non-finite number fails the N18 wire read; an empty layer still converts, toPascal.ts:707 always has
        // the SITE root). The defensive branch (versionHistoryScene.ts:110-115) is proven in vitest: VersionHistoryF4.test.tsx (32-B-019)
        // and VersionVisualDiff.test.tsx.

        await test.step('[32-B-027] N18 reports the version purged although the list said it had content: retention row, no error text', async () => {
          mock.snapshot = (id, call) => (id === v1 ? wireError(422, 'VERSION_SNAPSHOT_PURGED') : baseSnapshot(id, call));
          await openVersionsPage(page, projectId);
          await expect.soft(versionRow(page, 'v1')).toContainText(VH.retention); // VHG:60, 196-210
          await expect.soft(page.getByText(VH.snapshotFailed, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E06v_32-B-027_purged-row.png');
        });

        let failV1 = true;
        const failing = (id: string, call: Parameters<typeof baseSnapshot>[1]): Answer =>
          id === v1 && failV1 ? wireError(500, 'INTERNAL_ERROR') : baseSnapshot(id, call);
        const retryV1 = (): ReturnType<Page['getByRole']> => page.getByRole('button', { name: 'Thử lại tải nội dung v1', exact: true });

        await test.step('[32-B-028] N18 fails transiently on one row: row error, retry button, live region repeats it', async () => {
          mock.snapshot = failing;
          await openVersionsPage(page, projectId);
          await expect.soft(versionRow(page, 'v1')).toContainText(VH.snapshotFailed, { timeout: 30_000 }); // VL:324-335, VHM:418-420
          await expect.soft(retryV1()).toBeVisible();
          await expect.soft(page.getByRole('status', { name: VH.snapshotStatus })).toHaveText(`v1: ${VH.snapshotFailed}`); // VL:358-367
          await captureEvidence(page, 'E06v_32-B-028_row-error.png');
        });

        await test.step('[32-A-041] row "Thử lại" refetches that snapshot only and puts focus on the row', async () => {
          const mark = mock.calls.length;
          failV1 = false;
          await retryV1().click(); // VL:291-295
          await expect.soft(page.getByText(VH.snapshotFailed, { exact: true })).toHaveCount(0);
          expect.soft(mock.count('snapshot', mark, v1), 'one new GET snapshot of v1').toBe(1);
          expect.soft(mock.count('snapshot', mark), 'no other snapshot is read again').toBe(1);
          await expect.soft(versionRow(page, 'v1')).toBeFocused();
          await captureEvidence(page, 'E06v_32-A-041_row-retry.png');
        });

        await test.step('[32-E-015] row retry button returns focus to its row', async () => {
          failV1 = true;
          await openVersionsPage(page, projectId);
          await expect(retryV1()).toBeVisible({ timeout: 30_000 });
          failV1 = false;
          await retryV1().click();
          await expect.soft(versionRow(page, 'v1')).toBeFocused(); // VL:291-295 closest('li').focus()
          await captureEvidence(page, 'E06v_32-E-015_retry-focus.png');
        });

        await test.step('[32-C-054] row retry keeps the checkbox state and the list order', async () => {
          failV1 = true;
          await openVersionsPage(page, projectId);
          await expect(retryV1()).toBeVisible({ timeout: 30_000 });
          const ticked = () => versionList(page).getByRole('checkbox', { checked: true }).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
          const order = () => versionList(page).getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
          const [tickedBefore, orderBefore] = [await ticked(), await order()];
          failV1 = false;
          await retryV1().click();
          await expect(page.getByText(VH.snapshotFailed, { exact: true })).toHaveCount(0);
          expect.soft(await ticked(), 'same two ticks').toEqual(tickedBefore);
          expect.soft(await order(), 'same order').toEqual(orderBefore);
          await captureEvidence(page, 'E06v_32-C-054_retry-keeps-ticks.png');
        });

        await test.step('[32-G-007] N18 422 VERSION_SNAPSHOT_PURGED or VERSION_FLOOR_MISMATCH is read as "purged" (no error row)', async () => {
          for (const code of ['VERSION_SNAPSHOT_PURGED', 'VERSION_FLOOR_MISMATCH']) {
            mock.snapshot = (id, call) => (id === v1 ? wireError(422, code) : baseSnapshot(id, call));
            await openVersionsPage(page, projectId);
            await expect.soft(versionRow(page, 'v1'), code).toContainText(VH.retention); // VHG:60, 196-206
            await expect.soft(page.getByText(VH.snapshotFailed, { exact: true }), code).toHaveCount(0);
          }
          await captureEvidence(page, 'E06v_32-G-007_purged-codes.png');
        });

        await test.step('[32-B-023] browser without WebGL: renderer-missing state on "Trực quan"', async () => {
          reset();
          await openVersionsPage(page, projectId);
          await page.evaluate(() => sessionStorage.setItem('qa-no-webgl', '1'));
          await page.reload(); // the init script reads the flag at every getContext call
          await expect(heading(page)).toBeVisible();
          await diffTab(page, 'Trực quan').click();
          await expect.soft(page.getByText(VH.webglTitle, { exact: true })).toBeVisible({ timeout: 30_000 }); // VV:32-35, 130-137
          await expect.soft(page.getByText(VH.webglBody, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E06v_32-B-023_no-webgl.png');
        });
      },
      { qc: true },
    );
  });

  test('SCR-32 · FL-32-15 · [mocked response] restore write errors (real pairing: FL-32-08 successful restore, FL-32-09 real 409)', async ({ browser }) => {
    test.setTimeout(420_000);
    await withRig(
      browser,
      'versions-15',
      async ({ flow, page, mock, projectId, floorName, reset }) => {
        mock.setHistory(history(2));
        const mockRestore = async (answer: Answer, expected: { title: string; message: string | RegExp }): Promise<void> => {
          mock.restore = () => answer;
          await confirmRestore(page);
          await expect.soft(banner(page, expected.title)).toBeVisible({ timeout: 30_000 });
          await expect.soft(page.getByText(expected.message)).toBeVisible();
        };
        const dismiss = async (): Promise<void> => {
          await page.getByRole('button', { name: VH.gotIt, exact: true }).click();
          await expect(page.getByRole('button', { name: VH.gotIt, exact: true })).toHaveCount(0);
        };

        await test.step('[32-C-052] restore replay by the server (200 instead of 201) is treated like a restored version', async () => {
          await openVersionsPage(page, projectId);
          mock.restore = (_id, call) => ok(summaryOf({ sequence: 4, floorRevision: Number(call.body?.baseVersion ?? 0) + 1, note: 'phục hồi (mock replay)' }), 200);
          await confirmRestore(page);
          await expect(toast(page, VH.restoredToast('v2', floorName))).toBeVisible(); // VHG:225-231
          await captureEvidence(page, 'E06v_32-C-052_replay-200.png');
        });

        await test.step('[32-C-027] 422 VALIDATION on field baseVersion is shown as the same conflict', async () => {
          await openVersionsPage(page, projectId);
          await mockRestore(wireError(422, 'VALIDATION', { field: 'baseVersion' }), { title: VH.conflictTitle, message: /^Người khác đã sửa tầng này/u }); // VHG:129-131
          await captureEvidence(page, 'E06v_32-C-027_validation-base.png');
        });

        await test.step('[32-C-028] restore error FORBIDDEN: banner "Chưa phục hồi được" with "Đã hiểu"', async () => {
          await mockRestore(wireError(403, 'FORBIDDEN'), { title: VH.restoreErrorTitle, message: VH.forbiddenWrite }); // VHM:405-407, 431
          await expect.soft(page.getByRole('button', { name: VH.gotIt, exact: true })).toBeVisible();
          await captureEvidence(page, 'E06v_32-C-028_forbidden.png');
        });

        await test.step('[32-C-029] restore error LAYER_INTEGRITY_BROKEN', async () => {
          await mockRestore(wireError(422, 'LAYER_INTEGRITY_BROKEN'), { title: VH.restoreErrorTitle, message: 'Nội dung bản này không còn khớp toàn vẹn của tầng, nên không phục hồi được.' }); // VHM:432
          await captureEvidence(page, 'E06v_32-C-029_integrity.png');
        });

        await test.step('[32-C-030] restore error REVIEW_BY_AI_FORBIDDEN', async () => {
          await mockRestore(wireError(422, 'REVIEW_BY_AI_FORBIDDEN'), { title: VH.restoreErrorTitle, message: 'Bản này sẽ ghi dấu "đã duyệt" cho kết quả của AI, nên không phục hồi được.' }); // VHM:434
          await captureEvidence(page, 'E06v_32-C-030_review-by-ai.png');
        });

        await test.step('[32-C-031] restore error VALIDATION (not on baseVersion)', async () => {
          await mockRestore(wireError(422, 'VALIDATION', { field: 'floorId' }), { title: VH.restoreErrorTitle, message: 'Không phục hồi được bản này.' }); // VHM:436
          await captureEvidence(page, 'E06v_32-C-031_validation.png');
        });

        await test.step('[32-C-032] restore error VERSION_FLOOR_MISMATCH', async () => {
          await mockRestore(wireError(422, 'VERSION_FLOOR_MISMATCH'), { title: VH.restoreErrorTitle, message: 'Bản này không thuộc tầng đang chọn.' }); // VHM:437
          await captureEvidence(page, 'E06v_32-C-032_floor-mismatch.png');
        });

        await test.step('[32-C-034] restore error NETWORK / TIMEOUT: "Chưa rõ đã phục hồi chưa, bấm lại."', async () => {
          const unknown = 'Chưa rõ đã phục hồi chưa, bấm lại.'; // VHM:426, 433, 435
          await mockRestore({ abort: true }, { title: VH.restoreErrorTitle, message: unknown }); // NETWORK
          await captureEvidence(page, 'E06v_32-C-034_network.png');
          await dismiss();
          // TIMEOUT: the request never answers; the 15 s request timer (lib/http/timeout.ts REQUEST_TIMEOUT_MS) is fast-forwarded.
          // S5-confirm: page.clock.fastForward fires the HTTP client's abort timer the way a real 15 s wait would.
          mock.restore = () => ({ ...ok({}), hold: new Promise<void>(() => undefined) });
          const sent = mock.calls.length;
          await confirmRestore(page);
          await expect.poll(() => mock.count('restore', sent)).toBe(1); // the request (and its 15 s timer) exists before the clock moves
          await page.clock.fastForward(20_000);
          await expect.soft(banner(page, VH.restoreErrorTitle)).toBeVisible({ timeout: 30_000 });
          await expect.soft(page.getByText(unknown)).toBeVisible();
        });

        await test.step('[32-C-035] restore error with an unknown code or status 500: "Máy chủ chưa nhận lượt phục hồi…"', async () => {
          await mockRestore(wireError(500, 'SOMETHING_NEW'), { title: VH.restoreErrorTitle, message: 'Máy chủ chưa nhận lượt phục hồi. Thử lại sau ít phút.' }); // VHM:411-413, 463
          await captureEvidence(page, 'E06v_32-C-035_unknown-code.png');
        });

        let afterFailure = 0;
        await test.step('[32-C-036] a restore error does not reload the floor and does not show the success toast', async () => {
          reset();
          await openVersionsPage(page, projectId);
          afterFailure = flow.sent.length;
          await mockRestore(wireError(500, 'SOMETHING_NEW'), { title: VH.restoreErrorTitle, message: 'Máy chủ chưa nhận lượt phục hồi. Thử lại sau ít phút.' });
          expect.soft(layerReads(flow, afterFailure), 'GET …/spatial/layer after the failure').toBe(0); // UVH:451-454
          await expect.soft(toast(page, /^Đã phục hồi phiên bản/u)).toHaveCount(0);
          await captureEvidence(page, 'E06v_32-C-036_no-reload.png');
        });

        await test.step('[32-A-039] error banner button "Đã hiểu" just dismisses it (no reload)', async () => {
          await dismiss();
          await expect.soft(banner(page, VH.restoreErrorTitle)).toHaveCount(0);
          expect.soft(layerReads(flow, afterFailure), 'GET …/spatial/layer after "Đã hiểu"').toBe(0); // UVH:542-550
          await captureEvidence(page, 'E06v_32-A-039_dismissed.png');
        });
      },
      { clock: true },
    );
  });

  test('SCR-32 · FL-32-16 · [mocked response] reload failure, undo failures, label errors (real pairing: FL-32-08 undo, FL-32-05 label, FL-32-10 real 403)', async ({ browser }) => {
    test.setTimeout(420_000);
    await withRig(
      browser,
      'versions-16',
      async ({ page, mock, projectId, reset }) => {
        mock.setHistory(history(4));
        const baseRestore = mock.restore;
        /** Answers of the NEXT undo POST(s); the first restore POST of a step always succeeds. */
        let undoAnswers: Answer[] = [];
        let restorePhase: 'restore' | 'undo' = 'restore';
        mock.restore = (id, call) => {
          if (restorePhase === 'restore') {
            restorePhase = 'undo';
            return baseRestore(id, call);
          }
          return undoAnswers.shift() ?? baseRestore(id, call);
        };
        /** Fresh page, a successful restore (toast with "Hoàn tác"), then `undoAnswers` serve the undo. */
        const restoreThenArmUndo = async (...answers: Answer[]): Promise<void> => {
          restorePhase = 'restore';
          undoAnswers = answers;
          await openVersionsPage(page, projectId);
          await confirmRestore(page);
          await expect(toast(page, /^Đã phục hồi phiên bản v\d+ của/u)).toBeVisible();
        };
        const undoButton = () => toast(page, /^Đã phục hồi phiên bản/u).getByRole('button', { name: VH.undo, exact: true });
        const expectNotice = async (title: string, message: string): Promise<void> => {
          await expect.soft(banner(page, title)).toBeVisible({ timeout: 30_000 });
          await expect.soft(page.getByText(message, { exact: true })).toBeVisible();
        };
        const undoWith = async (answer: Answer): Promise<void> => {
          await restoreThenArmUndo(answer);
          await undoButton().click(); // real click on purpose (BUG-P06 32-C-040: a fading-out Modal veil used to intercept pointer events; Modal.exit.test.tsx)
        };

        await test.step('[32-B-031] reload after a write failed: banner "Chưa tải lại được tầng" with "Tải lại"', async () => {
          restorePhase = 'restore';
          await openVersionsPage(page, projectId);
          const layerUrl = /\/floors\/[^/]+\/spatial\/layer(?:\?.*)?$/u;
          const failLayer = (route: Route): Promise<void> =>
            route.request().method() === 'GET'
              ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'qa', requestId: 'qa-n16' }) })
              : route.fallback();
          await page.route(layerUrl, failLayer);
          await confirmRestore(page);
          await expectNotice(VH.reloadFailedTitle, VH.reloadFailedMessage); // VHM:470-475, UVH:351-353
          await expect.soft(banner(page, VH.reloadFailedTitle).getByRole('button', { name: VH.conflictDismiss, exact: true })).toBeVisible();
          await captureEvidence(page, 'E06v_32-B-031_reload-failed.png');
          await page.unroute(layerUrl, failLayer);
        });

        await test.step('[32-B-032] undo after the window: banner "Đã hết thời gian hoàn tác" with "Tải lại"', async () => {
          await restoreThenArmUndo();
          // No hover: a held toast also holds the undo ticket's clock (Toast.tsx:80-89, undoTicket.ts:43-96).
          // S5-confirm: setSystemTime moves only Date (no timers/rAF run), so the toast is still up and the ticket reads as expired.
          const now = await page.evaluate(() => Date.now());
          await page.clock.setSystemTime(now + 9_000);
          await undoButton().click();
          await expectNotice(VH.undoExpiredTitle, VH.undoExpiredMessage); // VHG:99-104, UVH:363-368
          await page.clock.resume(); // setSystemTime leaves the installed clock frozen: later toasts must animate again or clicks are "not stable" (32-C-037)
          await expect.soft(banner(page, VH.undoExpiredTitle).getByRole('button', { name: VH.conflictDismiss, exact: true })).toBeVisible();
          await captureEvidence(page, 'E06v_32-B-032_undo-expired.png');
        });

        await test.step('[32-B-033] undo conflict from the server: banner with the conflict text', async () => {
          await undoWith(wireError(409, 'VERSION_CONFLICT', { currentVersion: 9, remoteChanges: [] }));
          await expect.soft(banner(page, VH.conflictTitle)).toBeVisible({ timeout: 30_000 }); // UVH:387-392
          await expect.soft(page.getByText(/^Người khác đã sửa tầng này/u)).toBeVisible();
          await captureEvidence(page, 'E06v_32-B-033_undo-conflict.png');
        });

        await test.step('[32-C-037] undo error FORBIDDEN: "Chưa hoàn tác được" / role sentence', async () => {
          await undoWith(wireError(403, 'FORBIDDEN'));
          await expectNotice(VH.undoErrorTitle, VH.forbiddenWrite); // VHM:405-408, 441
          await captureEvidence(page, 'E06v_32-C-037_undo-forbidden.png');
        });

        await test.step('[32-C-038] undo error NETWORK: "Chưa rõ đã hoàn tác chưa; tải lại trang để xem hiện trạng."', async () => {
          await undoWith({ abort: true }); // TIMEOUT shares the sentence (VHM:442-443); the 15 s timer path is exercised in FL-32-15
          await expectNotice(VH.undoErrorTitle, 'Chưa rõ đã hoàn tác chưa; tải lại trang để xem hiện trạng.');
          await captureEvidence(page, 'E06v_32-C-038_undo-network.png');
        });

        await test.step('[32-C-039] undo error VERSION_SNAPSHOT_PURGED', async () => {
          await undoWith(wireError(422, 'VERSION_SNAPSHOT_PURGED'));
          await expectNotice(VH.undoErrorTitle, 'Bản trước lượt phục hồi không còn nội dung, nên không hoàn tác được.'); // VHM:444
          await captureEvidence(page, 'E06v_32-C-039_undo-purged.png');
        });

        await test.step('[32-C-040] undo error, other code: fallback banner and a retry toast whose "Hoàn tác" retries', async () => {
          await restoreThenArmUndo(wireError(500, 'SOMETHING_NEW')); // the retry (second undo POST) falls through to the success answer
          await undoButton().click(); // real click: the closing restore dialog must not cover the toast (BUG-P06 32-C-040, Modal.exit.test.tsx)
          await expectNotice(VH.undoErrorTitle, 'Máy chủ chưa nhận lượt hoàn tác. Thử lại sau ít phút.'); // VHM:413, 423
          const retryToast = toast(page, VH.undoRetryToast); // UVH:396-403
          await expect.soft(retryToast).toBeVisible();
          await retryToast.hover(); // holds the ticket's 8 s window (undoTicket.ts) while the evidence is taken
          await captureEvidence(page, 'E06v_32-C-040_undo-retry-toast.png');
          const mark = mock.calls.length;
          await retryToast.getByRole('button', { name: VH.undo, exact: true }).click();
          await expect.soft(toast(page, VH.undoneToast)).toBeVisible({ timeout: 30_000 });
          expect.soft(mock.count('restore', mark), 'the retry sends one more N19').toBe(1);
        });

        const labelStep = async (answer: Answer, title: string, message: string): Promise<void> => {
          reset();
          mock.label = () => answer;
          await openVersionsPage(page, projectId);
          await submitLabel(page, 'nhãn thử');
          await expectNotice(title, message);
        };

        await test.step('[32-C-041] label error FORBIDDEN', async () => {
          await labelStep(wireError(403, 'FORBIDDEN'), VH.labelErrorTitle, VH.forbiddenLabel); // VHM:408, 447
          await captureEvidence(page, 'E06v_32-C-041_label-forbidden.png');
        });

        await test.step('[32-C-042] label error VALIDATION: "Nhãn dài tối đa 60 ký tự."', async () => {
          await labelStep(wireError(422, 'VALIDATION', { field: 'label' }), VH.labelErrorTitle, 'Nhãn dài tối đa 60 ký tự.'); // VHM:448
          await captureEvidence(page, 'E06v_32-C-042_label-validation.png');
        });

        await test.step('[32-C-044] label error, other: fallback', async () => {
          await labelStep(wireError(500, 'SOMETHING_NEW'), VH.labelErrorTitle, 'Máy chủ chưa nhận nhãn này. Thử lại sau ít phút.'); // VHM:414
          await captureEvidence(page, 'E06v_32-C-044_label-fallback.png');
        });
      },
      { clock: true },
    );
  });
});
