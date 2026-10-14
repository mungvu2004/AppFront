/**
 * Phase 5 — SCR-27 mobile viewer, EDGE layer, MOCKED RESPONSES: three flows (QA-05c P6, flows-C5
 * "phase05_mobile_mocked_edge.spec.ts"), 16 steps, one `test.step('[<row id>] …')` per catalog row. Every flow title carries
 * `[mocked response]`: the states below cannot be made on the real stack (a weak device, a 5xx, a refresh with no role,
 * a held chunk). What stays real: the project, its floor and layer (Q1 through the API), the login and every request the
 * mock does not touch (`route.fetch()` answers are the real ones, only patched).
 *
 * Mocks (plumbing in `support/p05/P6.ts`) and their real pairing:
 * | mock | rows | real pairing |
 * |---|---|---|
 * | `M:chunk-delay` hold `MobileViewer.connected-*.js` | 27-B-001 | FL-27-01 (real load + success) |
 * | `M:N15-delay` hold `GET /api/projects/:p/spatial` | 27-B-002 | FL-27-01 (real load), FL-27-08 (real SPA switch holds N15) |
 * | `M:#24-blank-name` real #24 with `name: "   "` | 27-A-002 | FL-27-01 (real `h1` = project name); BE refuses a blank name |
 * | `M:N15-blank-level` real N15, first level `name: "   "` | 27-A-009 | FL-27-02 (real floor labels); BE floor name is required |
 * | `M:webgl-off` init script, `getContext('webgl*')` → null | 27-B-010, 27-E-009, 27-B-011 | FL-27-01 (real success on a WebGL browser) |
 * | `M:mount-abort` abort `/assets/pascal/pascal-mount.js` | 27-B-012 | unpairable: loss of a static asset (network) |
 * | `M:refresh-roles-empty` real refresh with `roles: []` | 27-B-013 | FL-27-11 in phase05_roles_edge (real roles); BE always sends one role |
 * | `M:ping-503` `HEAD /` → 503 | 27-B-008 | FL-27-01 27-B-007 (real offline, same note) |
 * | `M:#24-500`, `M:N15-500`, `M:N15-abort`, `M:rule-config-500` | 27-B-017..021, 27-G-003 | FL-27-10 (real 404 gate), FL-27-01 (real #24/N15/N21) |
 * 5xx and network loss are unpairable on a healthy shared stack.
 *
 * Deviation recorded: 27-A-009 answers the first level with a whitespace name `"   "`, not `""` as the catalog says —
 * `LevelSchema` (src/api/schemas/spatial.ts:397) is `z.string().min(1)`, so `""` would be a decode error; `"   "` passes
 * the schema and `name.trim()===''` (MVG:138) is the branch under test.
 *
 * ## Request budget (3 flows)
 * - `POST /api/auth/login` 3 + 1 (27-B-013 second context) = 4; `POST /api/auth/refresh` 4 fixture tokens + ~1 per page
 *   load (≈ 30; the mocked refresh in 27-B-013 is a real refresh, patched).
 * - `POST /api/projects` 3, `DELETE` 3 (Q1 each), N16 GET + #35 PUT 3.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { captureEvidence } from './support/evidence';
import {
  MV,
  PHONE,
  SCENE_TIMEOUT_MS,
  closeMobileFlow,
  failRoute,
  floorRows,
  holdRoute,
  host,
  mobileUrl,
  nav,
  note,
  openMobileFlow,
  patchJson,
  projectRe,
  refreshWithRoles,
  region,
  ruleConfigRe,
  seedQc,
  spaNavigate,
  spatialRe,
  successText,
  tool,
  waitBuilt,
  webglOff,
  type MobileFlow,
} from './support/p05/P6';

const shot = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E05_${id}_${slug}.png`);
const closeAll = async (flow: MobileFlow | undefined): Promise<void> => {
  expect.soft(await closeMobileFlow(flow), 'fixture cleanup').toEqual([]);
};
const chunkRe = /\/MobileViewer\.connected-[^/]*\.js$/u;
const rewrites = (page: Page): Promise<void> => page.unrouteAll({ behavior: 'ignoreErrors' });
/** The read-error alert of the gate: the one with a "Thử lại" button (PSG:78-91). */
const readAlert = (page: Page): ReturnType<Page['getByRole']> =>
  page.getByRole('alert').filter({ has: page.getByRole('button', { name: MV.retry, exact: true }) });

test.describe('E05 SCR-27 mobile viewer — mocked-response flows (QA-05c P6)', () => {
  // Pairs: FL-27-01 (real load / success), FL-27-02 (real floor labels).
  test('SCR-27 · FL-27-12 · [mocked response] loading and name fallbacks', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page } = flow;
      const q1 = await seedQc(flow, 'm27-mock-load'); // Q1
      let levelOrder = 0;

      await test.step('[27-B-001] H: M:chunk-delay → role="status" "Đang tải mô hình"', async () => {
        const chunk = await holdRoute(page, 'GET', (path) => chunkRe.test(path));
        await page.goto(mobileUrl(q1.id), { waitUntil: 'commit' });
        await chunk.arrived;
        await expect(page.getByRole('status').filter({ hasText: MV.loading })).toBeVisible(); // MVR:98-108
        await shot(page, '27-B-001', 'chunk_fallback');
        chunk.release();
        await expect(region(page)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        await waitBuilt(page);
      });

      await test.step('[27-B-002] M:N15-delay → floating "Đang tải mô hình" with the tool bar', async () => {
        await rewrites(page);
        const n15 = await holdRoute(page, 'GET', (path) => spatialRe(q1.id).test(path));
        await page.goto(mobileUrl(q1.id));
        await n15.arrived;
        await expect.soft(note(page, MV.loading)).toBeVisible(); // UMV:197-201, 479-484, MVV:129-134
        await expect.soft(nav(page)).toBeVisible();
        await shot(page, '27-B-002', 'n15_held');
        n15.release();
        await waitBuilt(page);
      });

      await test.step('[27-A-002] M:#24-blank-name → "Dự án chưa có tên"', async () => {
        await rewrites(page);
        await patchJson(page, 'GET', (path) => projectRe(q1.id).test(path), (body: Record<string, unknown>) => ({ ...body, name: '   ' }));
        await page.reload();
        await expect.soft(region(page).getByRole('heading', { level: 1, name: MV.unnamed, exact: true })).toBeVisible(); // UMV:97, 210-214
        await shot(page, '27-A-002', 'unnamed_project');
      });

      await test.step('[27-A-009] M:N15-blank-level → floor row "Tầng <order>"', async () => {
        await rewrites(page);
        await patchJson(
          page,
          'GET',
          (path) => spatialRe(q1.id).test(path),
          (doc: { graph: { levels: { name: string; order: number }[] } }) => {
            const first = doc.graph.levels[0];
            if (first !== undefined) {
              first.name = '   ';
              levelOrder = first.order;
            }
            return doc;
          },
        );
        await page.reload();
        await expect(region(page)).toBeVisible();
        await waitBuilt(page);
        await tool(page, MV.floors).click();
        await expect.soft(floorRows(page).locator('span.truncate')).toHaveText([`Tầng ${String(levelOrder)}`]); // MVG:138, 141-145
        await shot(page, '27-A-009', 'blank_level_label');
      });
    } finally {
      await closeAll(flow);
    }
  });

  // Pairs: FL-27-01 (real success on WebGL), FL-27-11 in phase05_roles_edge (real roles), FL-27-01 27-B-007 (real weak network).
  test('SCR-27 · FL-27-13 · [mocked response] weak device, forbidden, ping', async ({ browser }) => {
    test.setTimeout(150_000);
    let flow: MobileFlow | undefined;
    let forbidden: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, context } = flow;
      const q1 = await seedQc(flow, 'm27-mock-weak'); // Q1

      await test.step('[27-B-010] H: M:webgl-off → weak-device layer, no canvas host', async () => {
        await page.addInitScript(webglOff);
        await page.goto(mobileUrl(q1.id));
        await expect(page.getByRole('heading', { name: MV.weakTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:70-90
        await expect(page.getByText(MV.weakDesc, { exact: true })).toBeVisible();
        await expect(host(page)).toHaveCount(0); // MVV:213, MVP:57-61
        await shot(page, '27-B-010', 'weak_device');
      });

      await test.step('[27-E-009] The way out is a link at least 44 px tall', async () => {
        const link = region(page).getByRole('link', { name: MV.weakLink, exact: true });
        await expect.soft(link).toBeVisible(); // MVV:80-85
        expect.soft((await link.boundingBox())?.height ?? 0, 'link height (px)').toBeGreaterThanOrEqual(44); // MVT:67
        await shot(page, '27-E-009', 'way_out_link');
      });

      await test.step('[27-B-011] "Xem bản 2D" opens the floor list of the same project', async () => {
        await region(page).getByRole('link', { name: MV.weakLink, exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.floors(q1.id)); // UMV:528
        await shot(page, '27-B-011', 'floor_list');
      });

      await test.step('[27-B-012] ⚑ M:mount-abort → a retry action, not only "Xem bản 2D"', async () => {
        // MVP:64-68 turns any load failure into `deviceTooWeak`: the layer offers no retry. A network failure is not a weak device.
        const second = await context.newPage();
        try {
          await second.route('**/assets/pascal/pascal-mount.js*', (route) => route.abort('failed'));
          await second.goto(mobileUrl(q1.id));
          const retry = second.getByRole('button', { name: MV.retry, exact: true });
          await expect(retry.or(second.getByRole('heading', { name: MV.weakTitle, exact: true }))).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
          await expect.soft(retry, 'a retry button for a bundle that failed to load').toBeVisible();
          await shot(second, '27-B-012', 'bundle_aborted');
        } finally {
          await second.close();
        }
      });

      await test.step('[27-B-013] M:refresh-roles-empty → forbidden layer, no floating note', async () => {
        forbidden = await openMobileFlow(browser); // new context: the refresh answer is part of the session bootstrap
        await refreshWithRoles(forbidden.page, []);
        await forbidden.page.goto(mobileUrl(q1.id));
        await expect.soft(forbidden.page.getByRole('heading', { name: MV.forbiddenTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // UMV:291, 473-475
        await expect.soft(forbidden.page.getByText(MV.forbiddenDesc, { exact: true })).toBeVisible();
        await expect.soft(region(forbidden.page).locator('main div.pointer-events-none')).toHaveCount(0); // MVV:59-67 floating note
        await shot(forbidden.page, '27-B-013', 'forbidden');
      });

      await test.step('[27-B-008] M:ping-503 → weak-network note after the first ping', async () => {
        const third = await context.newPage();
        try {
          let pinged: () => void = () => undefined;
          const firstPing = new Promise<void>((resolve) => {
            pinged = resolve;
          });
          await third.route(
            (url) => url.pathname === '/',
            async (route) => {
              if (route.request().method() !== 'HEAD') {
                await route.fallback();
                return;
              }
              pinged();
              await route.fulfill({ status: 503 });
            },
          );
          await third.goto(mobileUrl(q1.id));
          await firstPing; // NM:54-66, 115-117 pingOnline=false
          await expect.soft(note(third, MV.weakNetwork)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
          await shot(third, '27-B-008', 'ping_503');
        } finally {
          await third.close();
        }
      });
    } finally {
      await closeAll(forbidden);
      await closeAll(flow);
    }
  });

  // Pairs: FL-27-10 (real 404 gate), FL-27-01 (real #24 / N15 / N21).
  test('SCR-27 · FL-27-14 · [mocked response] gate read errors', async ({ browser }) => {
    test.setTimeout(150_000);
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net } = flow;
      const q1 = await seedQc(flow, 'm27-mock-gate'); // Q1

      await test.step('[27-B-017] H: M:#24-500 → read-error alert with retry, no region', async () => {
        await failRoute(page, 'GET', (path) => projectRe(q1.id).test(path), 500, 1);
        await page.goto(mobileUrl(q1.id));
        await expect(readAlert(page)).toBeVisible(); // PSG:78-91, UPS:126, 184
        await expect.soft(readAlert(page).getByText(MV.unknownTitle, { exact: true })).toBeVisible();
        await expect.soft(readAlert(page).getByText(MV.unknownDesc, { exact: true })).toBeVisible();
        await expect(region(page)).toHaveCount(0);
        await shot(page, '27-B-017', 'n24_500');
      });

      await test.step('[27-B-018] Retry refetches #24 and N15, the viewer renders', async () => {
        const before = { project: net.count('GET', projectRe(q1.id)), spatial: net.count('GET', spatialRe(q1.id)) };
        await readAlert(page).getByRole('button', { name: MV.retry, exact: true }).click(); // UPS:193-203 (500 was once)
        await expect.soft(region(page)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        expect.soft(net.count('GET', projectRe(q1.id)) - before.project, 'second GET /api/projects/:p').toBe(1);
        expect.soft(net.count('GET', spatialRe(q1.id)) - before.spatial, 'second GET …/spatial').toBe(1);
        await waitBuilt(page);
        await shot(page, '27-B-018', 'retry_ok');
      });

      await test.step('[27-B-019] Reload with M:N15-500 → the same alert', async () => {
        await rewrites(page);
        await failRoute(page, 'GET', (path) => spatialRe(q1.id).test(path), 500);
        await page.reload();
        await expect.soft(readAlert(page)).toBeVisible(); // UPS:126, 184-185 blocked = graphFailed && !hasGraph
        await expect.soft(readAlert(page).getByText(MV.unknownTitle, { exact: true })).toBeVisible();
        await expect.soft(region(page)).toHaveCount(0);
        await shot(page, '27-B-019', 'n15_500');
      });

      await test.step('[27-B-020] Reload with M:N15-abort → "Không liên lạc được với máy chủ…" + retry', async () => {
        await rewrites(page);
        await page.route(
          (url) => spatialRe(q1.id).test(url.pathname),
          (route) => route.abort('failed'),
        );
        await page.reload();
        // The HTTP client's own ladder (300 / 900 / 2700 ms) runs first, then the alert.
        await expect.soft(readAlert(page).getByText(MV.networkDesc, { exact: true })).toBeVisible({ timeout: 30_000 }); // vi.json errors.network
        await expect.soft(readAlert(page).getByRole('button', { name: MV.retry, exact: true })).toBeVisible();
        await shot(page, '27-B-020', 'n15_abort');
      });

      await test.step('[27-B-021] ⚑ N15 refresh fails while the store holds the graph (SPA re-entry)', async () => {
        // MVR:150 + PSG:96-102: the band and an `h-full` region share one `h-dvh` box, so the bottom bar is pushed off screen.
        await rewrites(page);
        await page.reload();
        await expect(region(page)).toBeVisible();
        await waitBuilt(page);
        await spaNavigate(page, '/');
        await expect(page.getByRole('heading', { name: MV.dashboardTitle })).toBeVisible();
        await failRoute(page, 'GET', (path) => spatialRe(q1.id).test(path), 500);
        await page.evaluate(() => window.history.back());
        await expect.soft(page.getByText(MV.refreshBand, { exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        await expect.soft(page.getByRole('button', { name: MV.retry, exact: true })).toBeVisible();
        await expect.soft(region(page), 'the viewer is kept').toBeVisible();
        const bar = await nav(page).boundingBox();
        expect.soft((bar?.y ?? Infinity) + (bar?.height ?? 0), 'bottom of the tool bar (px)').toBeLessThanOrEqual(PHONE.height);
        await shot(page, '27-B-021', 'refresh_band');
      });

      await test.step('[27-G-003] Reload with M:rule-config-500 → the viewer still reaches "Mô hình đã dựng xong."', async () => {
        await rewrites(page);
        await failRoute(page, 'GET', (path) => ruleConfigRe(q1.id).test(path), 500);
        await page.reload();
        await expect.soft(successText(page)).toBeAttached({ timeout: SCENE_TIMEOUT_MS }); // UPS:168 the N21 error is swallowed by the hook
        await expect.poll(() => net.count('GET', ruleConfigRe(q1.id), 500), { message: 'the mocked N21 500 was served' }).toBeGreaterThanOrEqual(1);
        await shot(page, '27-G-003', 'rule_config_500');
      });
    } finally {
      await closeAll(flow);
    }
  });
});
