/**
 * Phase 6 (QA-06b P7) — SCR-32 "Lịch sử phiên bản", dedicated UI-verification flows (skill `qa-verify-ui`): four flows
 * (FL-32-17..FL-32-20 of `flows-C5.md`), one `test()` per flow, one `test.step('[<row id>] …')` per state; every state runs
 * through `verifyUi` at 1920 / 1440 / 1024 / 768 (`support/ui-verify.ts`: overflow, off-screen controls, broken images as soft
 * expects; clipped / overlapping / small targets as data in `<name>.json`) plus the measured claim of the row.
 * Evidence `U06v_<row id>_<slug>_<width>.png` + `U06v_<row id>_<slug>.json`.
 *
 * Seeds (each flow owns its project, deleted in `afterAll`; the pipeline ones need `E2E_DRAWING_PNG`, else the flow skips
 * with an "Environment:" reason):
 *   FL-32-17 PV  `createPipelineProject` (v1 "before" + v2 "after", v2 "Hiện tại") + a pool viewer member (slot p06-vmock)
 *   FL-32-18 PU  PV + one `writeLayer` (v2 restorable); every state re-writes the layer first so no row is "Hiện tại"
 *   FL-32-19 V1F65  one empty floor with a 65-character name, 80-character project name (no pipeline, no versions)
 *   FL-32-20 PM  PU + alternating restores (`seedVersionLadder`, P6's versions.ts): 58 versions, 50 with content, page 1 = 50 rows
 * Mocked responses (3 states, FL-32-19 only): N17 500 / 403 / held, answered by `page.route` on the real project.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 4 admin APIs (one per flow `beforeAll`) + 1 pool viewer session; browser sessions reuse the
 *   admin storage state (`ensureAdminSession`, one refresh each) = ≈ 10.
 * - `drawings_init` (60 / 600 s per user): 3 (PV, PU, PM) — a failed flow re-runs its `beforeAll` (+1 each).
 * - Writes: 4 `POST /api/projects`, 3 uploads (#5/#6/#7), 3 #35 layer PUTs + one per state/viewport in FL-32-18 (≈ 20),
 *   ≈ 56 N19 restores (PM; the first adds 2 versions, the rest 1 each), 1 N20 label (FL-32-17), the restore/label clicks of FL-32-18 (≈ 8), 4 `DELETE /api/projects/:id`.
 */
import { existsSync, readFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Browser, type Locator, type Page, type Route } from '@playwright/test';

import { signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { createPipelineProject, deleteSeededProject, type SeededDrawing } from './support/drawingSeed';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { qcLayer, writeLayer, type LayerApi } from './support/layerSeed';
import { LONG_FLOOR_NAME, createLongNameProject, drawingPathOrSkip, labelVia, listVersions } from './support/p06/P7';
import { seedVersionLadder } from './support/p06/versions';
import { addProjectMember, poolUser, signInPoolUser } from './support/phase03Seed';
import { ADMIN_STATE_FILE as ADMIN_STORAGE_STATE_FILE } from './support/p06/adminState';
import { P06_VIEWPORTS, verifyUi } from './support/p06/viewports';
import { VH, banner, diffTab, floorSelect, heading, toast, versionList, versionRow } from './support/p06/versionMocks';

/** 4 widths × (load + diff / dialog / restore round trip). */
const ERROR_PAINT_TIMEOUT_MS = 45_000;
/** Start of the footer caption (VHM:502-503 RESTORE_CAPTION). */
const VH_CAPTION_START = /^Phục hồi không xoá phiên bản nào/u;
const LABEL_60 = 'Bản gửi chủ đầu tư sau buổi họp ngày 14 tháng 10, đã chốt tường'.slice(0, 60);

/* ---------------------------------------------------------------- sessions + measuring helpers */

/** One admin context from the stored session (rotated cookie written back); `body` runs all of a flow's states on its page. */
async function withAdminPage(browser: Browser, body: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    await body(await context.newPage());
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('locator has no box (not rendered)');
  return box;
}

/** `true` when `box` lies inside the viewport horizontally (±1 px). */
const withinWidth = (page: Page, box: Box): boolean => box.x >= -1 && box.x + box.width <= (page.viewportSize()?.width ?? 0) + 1;
const isWide = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024; // VHC:67 NARROW_QUERY (width < 1024px)

const openVersions = async (page: Page, projectId: string): Promise<void> => {
  await page.goto(`/projects/${projectId}/versions`); // ROUTES.project.versions
  await expect(heading(page)).toBeVisible();
};

/** Versions page of a floor with a pair: waits for the diff tabs. */
async function openDiff(page: Page, projectId: string): Promise<void> {
  await openVersions(page, projectId);
  await expect(diffTab(page, 'Thay đổi')).toBeVisible({ timeout: 30_000 });
}

const restoreButton = (page: Page): Locator => page.getByRole('button', { name: VH.restore, exact: true });
const tagButton = (page: Page): Locator => page.getByRole('button', { name: VH.tag, exact: true });

/** "Phục hồi phiên bản này" → "Phục hồi" (VH:195-211). */
async function confirmRestore(page: Page): Promise<void> {
  await expect(restoreButton(page)).toBeEnabled();
  await restoreButton(page).click();
  await page.getByRole('dialog').getByRole('button', { name: VH.restoreConfirm, exact: true }).click();
}

/* ================================================================= FL-32-17 */

test.describe('U06v SCR-32 version history — PV (QA-06b P7)', () => {
  let admin: APIRequestContext | undefined;
  let seed: SeededDrawing | undefined;
  let viewerFixture: { readonly email: string; readonly password: string } | undefined;

  test.beforeAll(async ({}, testInfo) => {
    const png = drawingPathOrSkip();
    testInfo.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    seed = await createPipelineProject(admin, 'versions-ui17', readFileSync(png));
    const viewer = await poolUser(admin, 'viewer', 'p06-vmock');
    await addProjectMember(admin, seed.projectId, viewer.email);
    viewerFixture = { email: viewer.email, password: viewer.password };
  });

  test.afterAll(async () => {
    const failure = admin !== undefined && seed !== undefined ? await deleteSeededProject(admin, seed.projectId) : null;
    if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
    await admin?.dispose();
  });

  test('SCR-32 · FL-32-17 · UI states on the AI project (admin) and the read-only view (viewer member)', async ({ browser }) => {
    test.setTimeout(330_000);
    if (admin === undefined || seed === undefined || viewerFixture === undefined) throw new Error('setup: PV was not created');
    const api = admin;
    const { projectId, floorId } = seed;

    await withAdminPage(browser, async (page) => {
      await test.step('[32-F-002] default pair, tab "Thay đổi": no overflow; footer note stacks above the buttons below 1024', async () => {
        await verifyUi(page, 'U06v_32-F-002_default-changes', async (p) => {
          await openDiff(p, projectId);
          await expect.soft(diffTab(p, 'Thay đổi')).toHaveAttribute('aria-selected', 'true');
          const note = await boxOf(p.getByText(VH_CAPTION_START).first()); // VH:149-163
          const button = await boxOf(tagButton(p));
          if (isWide(p)) expect.soft(Math.abs(note.y - button.y) < Math.max(note.height, button.height), 'one row from 1024').toBe(true);
          else expect.soft(note.y + note.height, 'note above the buttons below 1024 (BUG-437)').toBeLessThanOrEqual(button.y + 1);
        });
      });

      await test.step('[32-F-003] tab "JSON": lines scroll inside their own box, text not clipped', async () => {
        await verifyUi(page, 'U06v_32-F-003_json', async (p) => {
          await openDiff(p, projectId);
          await diffTab(p, 'JSON').click();
          const panel = p.getByRole('tabpanel', { name: 'JSON', exact: true });
          await expect(panel).toBeVisible();
          const clipped = await panel.evaluate((root) =>
            [root, ...root.querySelectorAll('*')]
              .filter((el): el is HTMLElement => el instanceof HTMLElement && /hidden|clip/u.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
              .map((el) => `${el.tagName} ${String(el.scrollWidth)}>${String(el.clientWidth)}`),
          );
          expect.soft(clipped, 'a box that hides overflowing JSON text instead of scrolling it (BUG-438, deferred)').toEqual([]); // VJ:61-70
          expect.soft(withinWidth(p, await boxOf(panel)), 'panel inside the viewport').toBe(true);
        });
      });

      await test.step('[32-F-004] tab "Trực quan": figure keeps 16:9 inside the column', async () => {
        await verifyUi(page, 'U06v_32-F-004_visual', async (p) => {
          await openDiff(p, projectId);
          await diffTab(p, 'Trực quan').click();
          const panel = p.getByRole('tabpanel', { name: 'Trực quan', exact: true });
          await expect(panel).toBeVisible();
          const column = await boxOf(panel);
          const figure = panel.locator('figure');
          if ((await figure.count()) > 0) {
            const host = await boxOf(figure.locator('div').first());
            expect.soft(Math.abs(host.width / host.height - 16 / 9), '16:9').toBeLessThan(0.05); // VV:167-181
            expect.soft(host.x + host.width, 'figure inside the column').toBeLessThanOrEqual(column.x + column.width + 1);
          } else {
            // S5-confirm: PV's left version (the empty "before" layer) builds no scene, so the unavailable copy stands in for the figure.
            const empty = await boxOf(panel.getByText('Chưa xem trực quan được', { exact: true }));
            expect.soft(empty.x + empty.width, 'unavailable copy inside the column').toBeLessThanOrEqual(column.x + column.width + 1);
          }
        });
      });

      await test.step('[32-F-011] version with a 60-character label: the badge does not push the time column out', async () => {
        const newest = (await listVersions(api, projectId, floorId, 1))[0];
        if (newest === undefined) throw new Error('setup: PV has no version');
        await labelVia(api, projectId, String(newest.id), LABEL_60);
        await verifyUi(page, 'U06v_32-F-011_long-label', async (p) => {
          await openDiff(p, projectId);
          if (await versionList(p).isVisible()) {
            const row = versionRow(p, `v${String(newest.sequence)}`);
            await expect.soft(row.getByText(LABEL_60, { exact: true })).toBeVisible(); // VL:318-323
            const rowBox = await boxOf(row);
            const time = await boxOf(row.locator('span[title]'));
            expect.soft(time.x + time.width, 'time column inside the row').toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
          } else {
            await expect.soft(p.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible(); // below 1024 the Select replaces the list
          }
        });
      });

      await test.step('[32-F-005] label dialog open: fits the viewport (width 480 max)', async () => {
        await verifyUi(
          page,
          'U06v_32-F-005_label-dialog',
          async (p) => {
            await openDiff(p, projectId);
            await tagButton(p).click();
            const dialog = p.getByRole('dialog');
            await expect(dialog.getByRole('textbox', { name: VH.labelField, exact: true })).toBeVisible();
            const box = await boxOf(dialog);
            expect.soft(box.width, 'dialog width').toBeLessThanOrEqual(481); // VD:424-445 width 480
            expect.soft(withinWidth(p, box), 'dialog inside the viewport').toBe(true);
          },
          P06_VIEWPORTS,
          { fullPage: false },
        );
      });
    });

    const context = await browser.newContext({ baseURL: readBaseUrl() });
    try {
      await signInPoolUser(context, { id: '', role: 'viewer', name: '', ...viewerFixture });
      const page = await context.newPage();
      await test.step('[32-F-010] viewer member: reason text instead of the restore button fits the footer', async () => {
        await verifyUi(page, 'U06v_32-F-010_viewer-reason', async (p) => {
          await openDiff(p, projectId);
          const reason = p.getByText(VH.viewerReason, { exact: true });
          await expect(reason).toBeVisible(); // VH:155-160
          await expect.soft(restoreButton(p)).toHaveCount(0);
          await expect.soft(tagButton(p)).toHaveCount(0);
          expect.soft(withinWidth(p, await boxOf(reason)), 'reason inside the viewport').toBe(true);
        });
      });
    } finally {
      await context.close();
    }
  });
});

/* ================================================================= FL-32-18 */

test.describe('U06v SCR-32 version history — PU (QA-06b P7)', () => {
  let admin: APIRequestContext | undefined;
  let seed: SeededDrawing | undefined;

  test.beforeAll(async ({}, testInfo) => {
    const png = drawingPathOrSkip();
    testInfo.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    seed = await createPipelineProject(admin, 'versions-ui18', readFileSync(png));
    await writeLayer({ request: admin, headers: {} }, seed.projectId, seed.floorId, qcLayer); // v2 no longer "Hiện tại"
  });

  test.afterAll(async () => {
    const failure = admin !== undefined && seed !== undefined ? await deleteSeededProject(admin, seed.projectId) : null;
    if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
    await admin?.dispose();
  });

  test('SCR-32 · FL-32-18 · UI: restore confirm, conflict banner, toast, list after restore', async ({ browser }) => {
    test.setTimeout(350_000);
    if (admin === undefined || seed === undefined) throw new Error('setup: PU was not created');
    const layerApi: LayerApi = { request: admin, headers: {} };
    const { projectId, floorId, floorName } = seed;
    /** Another writer: moves the floor revision past every version, so no row is "Hiện tại" and the newest is restorable. */
    const otherWriter = (): Promise<unknown> => writeLayer(layerApi, projectId, floorId, qcLayer);

    await withAdminPage(browser, async (page) => {
      await test.step('[32-F-006] restore confirm open: dialog fits, both buttons visible', async () => {
        await verifyUi(
          page,
          'U06v_32-F-006_restore-confirm',
          async (p) => {
            await otherWriter();
            await openDiff(p, projectId);
            await expect(restoreButton(p)).toBeEnabled();
            await restoreButton(p).click();
            const dialog = p.getByRole('dialog');
            await expect(dialog).toContainText(/Phục hồi phiên bản .+ của .+\?/u); // VH:195-211
            await expect.soft(dialog.getByRole('button', { name: VH.restoreConfirm, exact: true })).toBeVisible();
            await expect.soft(dialog.getByRole('button', { name: 'Để nguyên', exact: true })).toBeVisible();
            expect.soft(withinWidth(p, await boxOf(dialog)), 'dialog inside the viewport').toBe(true);
          },
          P06_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[32-F-007] conflict banner above the compare area: banner and its button visible, no overflow', async () => {
        await verifyUi(page, 'U06v_32-F-007_conflict-banner', async (p) => {
          await otherWriter();
          await openDiff(p, projectId);
          await expect(restoreButton(p)).toBeEnabled();
          await otherWriter(); // after the page read the revision: the restore is based on a stale one (UVH:418)
          await confirmRestore(p);
          const alert = banner(p, VH.conflictTitle);
          await expect(alert).toBeVisible(); // VH:110-117
          await alert.scrollIntoViewIfNeeded(); // BUG-469
          const action = alert.getByRole('button', { name: VH.conflictDismiss, exact: true });
          await expect.soft(action).toBeVisible();
          expect.soft(withinWidth(p, await boxOf(alert)), 'banner inside the viewport').toBe(true);
        });
      });

      await test.step('[32-F-016] toast "Đã phục hồi phiên bản v2 của Tầng 1; hoàn tác được trong 8 giây" with "Hoàn tác": fits the viewport', async () => {
        await verifyUi(
          page,
          'U06v_32-F-016_restored-toast',
          async (p) => {
            await otherWriter();
            await openDiff(p, projectId);
            await confirmRestore(p);
            const message = toast(p, new RegExp(`^Đã phục hồi phiên bản v\\d+ của ${floorName}; hoàn tác được trong 8 giây`, 'u'));
            await expect(message).toBeVisible(); // UVH:447-450
            await expect.soft(message.getByRole('button', { name: VH.undo, exact: true })).toBeVisible();
            expect.soft(withinWidth(p, await boxOf(message)), 'toast inside the viewport').toBe(true);
          },
          P06_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[32-F-017] list after a restore: new top rows with their notes and the "Hiện tại" badge, nothing hidden', async () => {
        await verifyUi(page, 'U06v_32-F-017_list-after-restore', async (p) => {
          await otherWriter();
          await openDiff(p, projectId);
          await confirmRestore(p);
          await expect(toast(p, /^Đã phục hồi phiên bản/u)).toBeVisible();
          if (isWide(p)) {
            const current = versionList(p).getByText(VH.current, { exact: true });
            await expect(current).toBeVisible(); // VL:318-342
            const row = versionList(p).getByRole('listitem').filter({ has: current });
            const [rowBox, badge] = [await boxOf(row), await boxOf(current)];
            expect.soft(badge.x + badge.width, 'badge inside its row').toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
            const time = await boxOf(row.locator('span[title]'));
            expect.soft(time.x + time.width, 'time column inside its row').toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
          } else {
            await expect.soft(p.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible(); // below 1024 the Select replaces the list
          }
        });
      });
    });
  });
});

/* ================================================================= FL-32-19 */

test.describe('U06v SCR-32 version history — V1F65 (QA-06b P7)', () => {
  let admin: APIRequestContext | undefined;
  let project: { projectId: string; floorId: string; floorName: string } | undefined;

  test.beforeAll(async () => {
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    project = await createLongNameProject(admin, 'versions-ui19');
  });

  test.afterAll(async () => {
    const failure = admin !== undefined && project !== undefined ? await deleteSeededProject(admin, project.projectId) : null;
    if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
    await admin?.dispose();
  });

  test('SCR-32 · FL-32-19 · UI: empty (65-char floor), list error [mocked response], forbidden [mocked response], loading [mocked response]', async ({ browser }) => {
    test.setTimeout(240_000);
    if (project === undefined) throw new Error('setup: V1F65 was not created');
    const { projectId } = project;
    const listUrl = new RegExp(`/api/projects/${projectId}/versions(?:\\?.*)?$`, 'u');

    await withAdminPage(browser, async (page) => {
      await test.step('[32-F-001] empty state with a 65-character floor name: no horizontal scroll, title wraps whole', async () => {
        await verifyUi(page, 'U06v_32-F-001_empty-long-floor', async (p) => {
          await openVersions(p, projectId);
          const title = p.getByText(`${LONG_FLOOR_NAME} chưa có phiên bản nào`, { exact: true });
          await expect(title).toBeVisible(); // UVH:611
          const box = await boxOf(title);
          expect.soft(withinWidth(p, box), 'title inside the viewport').toBe(true);
          expect.soft(await title.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'title not cut').toBe(true);
          expect.soft((await boxOf(floorSelect(p))).width, 'Select max 672 (BUG-455)').toBeLessThanOrEqual(673); // VH:48
        });
      });

      await test.step('[32-F-012] list error alert with its "Thử lại" button, under the floor Select [mocked response, real pairing FL-32-01/FL-32-03]', async () => {
        const fail = (route: Route): Promise<void> =>
          route.request().method() === 'GET'
            ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'qa', requestId: 'qa-ui-500' }) })
            : route.fallback();
        await page.route(listUrl, fail);
        await verifyUi(page, 'U06v_32-F-012_list-error', async (p) => {
          await openVersions(p, projectId);
          await expect(p.getByText(VH.listErrorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS }); // VH:90-104
          const retry = p.getByRole('button', { name: VH.retry, exact: true });
          await expect.soft(retry).toBeVisible();
          expect.soft(withinWidth(p, await boxOf(retry)), 'button inside the viewport').toBe(true);
          const select = await boxOf(floorSelect(p));
          expect.soft((await boxOf(p.getByRole('alert').first())).y, 'alert under the Select').toBeGreaterThanOrEqual(select.y + select.height - 1);
        });
        await page.unroute(listUrl, fail);
      });

      await test.step('[32-F-014] forbidden state "Không đủ quyền xem": icon, title and text fit; no Select; no overflow [mocked response]', async () => {
        const deny = (route: Route): Promise<void> =>
          route.request().method() === 'GET'
            ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'FORBIDDEN', message: 'qa', requestId: 'qa-ui-403' }) })
            : route.fallback();
        await page.route(listUrl, deny);
        await verifyUi(page, 'U06v_32-F-014_forbidden', async (p) => {
          await openVersions(p, projectId);
          const title = p.getByText(VH.forbiddenTitle, { exact: true });
          await expect(title).toBeVisible(); // VH:80-88
          await expect.soft(p.getByText(VH.forbiddenText, { exact: true })).toBeVisible();
          await expect.soft(floorSelect(p)).toHaveCount(0);
          expect.soft(withinWidth(p, await boxOf(title)), 'title inside the viewport').toBe(true);
        });
        await page.unroute(listUrl, deny);
      });

      await test.step('[32-F-015] loading skeletons under the heading and Select (N17 held) [mocked response]', async () => {
        // The held answers are never released: `unrouteAll` below drops them with the page (an answer for a navigated-away request would only throw).
        const held = (): Promise<void> => new Promise<void>(() => undefined);
        await page.route(listUrl, async (route) => {
          if (route.request().method() === 'GET') await held();
          else await route.fallback();
        });
        await verifyUi(page, 'U06v_32-F-015_loading', async (p) => {
          await p.goto(`/projects/${projectId}/versions`);
          await expect(heading(p)).toBeVisible();
          await expect.soft(floorSelect(p)).toBeVisible();
          await expect.soft(p.locator('.animate-pulse').first()).toBeVisible(); // VH:61-68 table-row + property-panel
          await expect.soft(versionList(p)).toHaveCount(0);
        });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });
    });
  });
});

/* ================================================================= FL-32-20 */

test.describe('U06v SCR-32 version history — PM (QA-06b P7)', () => {
  let admin: APIRequestContext | undefined;
  let seed: SeededDrawing | undefined;

  test.beforeAll(async ({}, testInfo) => {
    const png = drawingPathOrSkip();
    testInfo.setTimeout(PIPELINE_TIMEOUT_MS + 300_000);
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    seed = await createPipelineProject(admin, 'versions-ui20', readFileSync(png));
    const api: LayerApi = { request: admin, headers: {} };
    await writeLayer(api, seed.projectId, seed.floorId, qcLayer);
    await seedVersionLadder(admin, seed.projectId, seed.floorId, 58); // 58 versions: v58..v9 with content, v8..v1 without
  });

  test.afterAll(async () => {
    const failure = admin !== undefined && seed !== undefined ? await deleteSeededProject(admin, seed.projectId) : null;
    if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
    await admin?.dispose();
  });

  test('SCR-32 · FL-32-20 · UI: many versions, retention rows, Select open, disabled boxes', async ({ browser }) => {
    test.setTimeout(430_000);
    if (seed === undefined) throw new Error('setup: PM was not created');
    const { projectId } = seed;

    await withAdminPage(browser, async (page) => {
      await test.step('[32-F-008] many versions: first page with "Xem thêm phiên bản"; the list scrolls in its column, below 1024 the Select replaces it', async () => {
        await verifyUi(page, 'U06v_32-F-008_many-versions', async (p) => {
          await openDiff(p, projectId);
          if (isWide(p)) {
            const more = p.getByRole('button', { name: VH.loadMore, exact: true });
            await more.scrollIntoViewIfNeeded();
            await expect(more).toBeVisible(); // VH:127-139
            expect.soft(await versionList(p).evaluate((el) => el.scrollHeight > el.clientHeight && /auto|scroll/u.test(getComputedStyle(el).overflowY)), 'list scrolls inside its own column').toBe(true);
          } else {
            await expect.soft(p.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible();
            await expect.soft(versionList(p)).toHaveCount(0);
          }
        });
      });

      await test.step('[32-F-009] rows with the retention notice (after loading the next page): the notice wraps inside the row, no overlap', async () => {
        await verifyUi(page, 'U06v_32-F-009_retention-rows', async (p) => {
          await openDiff(p, projectId);
          if (isWide(p)) {
            await p.getByRole('button', { name: VH.loadMore, exact: true }).click();
            const row = versionRow(p, 'v8'); // the newest version without content (BE keeps 50)
            await row.scrollIntoViewIfNeeded();
            await expect(row).toContainText(VH.retention); // VL:339-341
            const [rowBox, notice, time] = [await boxOf(row), await boxOf(row.getByText(VH.retention, { exact: true })), await boxOf(row.locator('span[title]'))];
            expect.soft(notice.x + notice.width, 'notice inside the row').toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
            expect.soft(notice.x + notice.width <= time.x + 1 || notice.y + notice.height <= time.y + 1 || time.y + time.height <= notice.y + 1, 'notice and time column do not overlap').toBe(true);
          } else {
            // The "Xem thêm phiên bản" button lives only in the wide branch (VH:127-139), so below 1024 no retention row can be reached.
            await expect.soft(p.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible();
          }
        });
      });

      await test.step('[32-F-018] compare Select open with a long option list: `v… · …` options inside the viewport, scrollable', async () => {
        await verifyUi(
          page,
          'U06v_32-F-018_select-open',
          async (p) => {
            await openDiff(p, projectId);
            await p.getByRole('combobox', { name: VH.leftSelect, exact: true }).click(); // VC:184-199
            const options = p.getByRole('option');
            await expect(options.first()).toBeVisible();
            await expect.soft(options.first()).toHaveText(/^v\d+ · /u);
            const popup = p.getByRole('listbox');
            const box = await boxOf(popup);
            const viewport = p.viewportSize();
            expect.soft(withinWidth(p, box), 'popup inside the viewport').toBe(true);
            expect.soft(box.y >= -1 && box.y + box.height <= (viewport?.height ?? 0) + 1, 'popup inside the viewport height').toBe(true);
            expect.soft(await popup.evaluate((el) => el.scrollHeight > el.clientHeight), 'long list scrolls').toBe(true);
          },
          P06_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[32-F-019] two versions ticked and the others disabled: disabled boxes visibly dimmed, ticked ones clear', async () => {
        await verifyUi(page, 'U06v_32-F-019_disabled-boxes', async (p) => {
          await openDiff(p, projectId);
          if (isWide(p)) {
            const boxes = versionList(p).getByRole('checkbox');
            await expect(versionList(p).getByRole('checkbox', { checked: true })).toHaveCount(2); // VL:307-312
            const look = (box: Locator): Promise<string> =>
              box.evaluate((el) => {
                const label = el.closest('label') ?? el;
                const drawn = label.querySelector('span') ?? label;
                const [l, d] = [getComputedStyle(label), getComputedStyle(drawn)];
                return [l.opacity, l.cursor, d.opacity, d.backgroundColor, d.borderColor].join('|');
              });
            const disabled = boxes.and(p.locator(':disabled')).first();
            await expect.soft(disabled).toBeDisabled();
            expect.soft(await look(disabled), 'disabled looks different from ticked').not.toBe(await look(versionList(p).getByRole('checkbox', { checked: true }).first()));
          } else {
            await expect.soft(p.getByRole('combobox', { name: VH.narrowSelect, exact: true })).toBeVisible();
          }
        });
      });
    });
  });
});
