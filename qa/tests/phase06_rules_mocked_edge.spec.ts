/**
 * Phase 6 SCR-28 rule report, mocked-response edge flows (QA-06b, pack P2; flows-C1 `phase06_rules_mocked_edge.spec.ts`).
 * Every flow forces a failure or a slow answer the real backend cannot be made to give (N21 500, N15 500, a held N15, a
 * 422 unnamed-room on #35). Pairing real flows: FL-28-01 (healthy report) and FL-28V-03 (healthy quick fix) in
 * `phase06_rules_edge.spec.ts` (pack P1).
 *
 * Seed `R1` (`support/p06/P2.ts` createRuleProject): one floor, three FURNITURE-CLASH tables, a short wall. Created once in
 * `beforeAll`, deleted in `afterAll`. The mocked PUT never reaches the server, so the project stays as seeded and every
 * step re-opens the report fresh.
 *
 * Request budget (per worker): `POST /api/auth/login` 3 (fixtures + one `signInAdmin` per flow); 1 project, 1 #35 PUT,
 * 1 DELETE. Mocked: GET rule-config 500, GET spatial 500 / held, PUT layer 422 / abort / 404 / 500 (browser side only).
 * The rule-config / N15 500 answers are retried by the HTTP ladder + react-query before the error state paints, so those
 * steps wait up to ERROR_PAINT_TIMEOUT_MS. The 5 s retry of the offline autosave is stepped with `page.clock`.
 *
 * // S5-confirm: exact 422 body shape the FE reads (`raw` is the JSON array of zod issues, spatialLayerSave.ts:100-107).
 */
import { expect, test, type APIRequestContext, type BrowserContext, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi, type ApiEntry } from '../../e2e/fullstack/apiWatch';
import { ACTION_TIMEOUT_MS, NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { deleteSeededProject } from './support/drawingSeed';
import { captureEvidence } from './support/evidence';
import {
  ERROR_PAINT_TIMEOUT_MS,
  RR,
  RULE_NAME,
  VIEWPORT,
  createRuleProjectFor,
  failGet,
  levelFilter,
  makeGate,
  openRuleSheet,
  openRules,
  rerunButton,
  ruleConfigRe,
  settledInt,
  sheetOf,
  spatialRe,
  summaryValue,
} from './support/p06/P2';

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

let fixtureApi: APIRequestContext | undefined;
let projectId = '';
const created: string[] = [];

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  fixtureApi = await signedInApi(email, password);
  projectId = (await createRuleProjectFor({ request: fixtureApi, headers: {} }, 'rules-mocked', {}, created)).projectId;
});

test.afterAll(async () => {
  try {
    for (const id of created) {
      const failed = fixtureApi === undefined ? null : await deleteSeededProject(fixtureApi, id);
      if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
    }
  } finally {
    await fixtureApi?.dispose();
  }
});

/** A signed-in admin page with its own context; the caller closes `context`. */
async function adminPage(browser: import('@playwright/test').Browser): Promise<{ context: BrowserContext; page: Page; api: ApiEntry[] }> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: VIEWPORT });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  const page = await context.newPage();
  const api = watchApi(page);
  await signInAdmin(page);
  return { context, page, api };
}

const noHorizontalScroll = (page: Page): Promise<number> =>
  page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollWidth - window.innerWidth);

test('SCR-28 · FL-28-M1 · [mocked response] Rule config failure and recovery', async ({ browser }) => {
  // Pairing real flow: FL-28-01 (same screen healthy, pack P1).
  test.setTimeout(240_000);
  const { context, page, api } = await adminPage(browser);
  try {
    const counter = { served: 0 };
    const handler = failGet(ruleConfigRe(projectId), counter);
    let afterErrorMark = 0;

    await test.step('[28-B-009] GET rule-config 500: error state, no strip, no rerun, no confirm', async () => {
      await page.route('**/api/projects/**', handler);
      await page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' });
      await expect(page.getByText(RR.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(page.getByText(RR.configFailed, { exact: true })).toBeVisible();
      await expect(page.locator('dl')).toHaveCount(0);
      await expect(rerunButton(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: RR.confirm, exact: true })).toHaveCount(0);
      await expect(levelFilter(page)).toHaveCount(0);
      await captureEvidence(page, 'E06r_28-B-009_config_500.png');
    });

    await test.step('[28-F-008] error state at 1440 / 1024 / 768 / 375', async () => {
      for (const size of WIDTHS) {
        await page.setViewportSize(size);
        expect.soft(await noHorizontalScroll(page), `${String(size.width)} px: no horizontal scroll`).toBeLessThanOrEqual(0);
        await expect.soft(page.getByRole('button', { name: RR.retry, exact: true }), `${String(size.width)} px: "Thử lại"`).toBeInViewport();
      }
      await page.setViewportSize(VIEWPORT);
      await captureEvidence(page, 'E06r_28-F-008_error_widths.png');
    });

    await test.step('[28-B-010] "Thử lại" re-reads the config and recovers', async () => {
      afterErrorMark = api.length;
      await page.unroute('**/api/projects/**', handler);
      const reread = waitForApi(page, 'GET', ruleConfigRe(projectId), [200]);
      await page.getByRole('button', { name: RR.retry, exact: true }).click();
      await reread;
      await expect.soft(page.getByText(RR.errorTitle, { exact: true })).toHaveCount(0);
      await expect.soft(levelFilter(page)).toBeVisible();
      expect.soft(await settledInt(summaryValue(page, 'Tổng số kiểm tra')), 'report figures').toBeGreaterThan(0);
      await captureEvidence(page, 'E06r_28-B-010_retry_recovers.png');
    });

    await test.step('[28-G-005] wire: 500 answers then one 200, no spatial re-read', async () => {
      const configReads = api.filter((entry) => entry.method === 'GET' && ruleConfigRe(projectId).test(entry.path)).map((entry) => entry.status);
      // retry.ts:3 RETRYABLE_STATUSES = 429/502/503/504, so a 500 is NOT retried: reads = the gate's one-shot N21 hydration
      // (swallowed on error) + the report's own read (both 500), then the 200 of "Thử lại" (pinned exactly).
      expect.soft(configReads, 'N21 reads: 500, 500, then the 200 of "Thử lại"').toEqual([500, 500, 200]); // S5-confirm: count of reads before the click
      expect.soft(counter.served, 'mocked answers served').toBe(2);
      expect.soft(api.slice(afterErrorMark).filter((entry) => entry.method === 'GET' && spatialRe(projectId).test(entry.path)), 'no N15 re-read on retry').toEqual([]);
      await captureEvidence(page, 'E06r_28-G-005_wire.png');
    });

    await test.step('[28-G-006] aborted config read: same error state, retry recovers', async () => {
      const abort = async (route: Route): Promise<void> => {
        if (route.request().method() === 'GET' && ruleConfigRe(projectId).test(new URL(route.request().url()).pathname)) await route.abort('failed');
        else await route.fallback();
      };
      await page.route('**/api/projects/**', abort);
      await page.reload({ waitUntil: 'commit' });
      await expect(page.getByText(RR.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(page.getByText(RR.configFailed, { exact: true })).toBeVisible();
      await page.unroute('**/api/projects/**', abort);
      await page.getByRole('button', { name: RR.retry, exact: true }).click();
      await expect.soft(levelFilter(page)).toBeVisible();
      await captureEvidence(page, 'E06r_28-G-006_aborted_recovers.png');
    });
  } finally {
    await context.close();
  }
});

test('SCR-28 · FL-28-M2 · [mocked response] Model read and save failures', async ({ browser }) => {
  // Pairing real flows: FL-28-01 / FL-28V-03 (healthy N15 and PUT, pack P1).
  test.setTimeout(360_000);
  const { context, page, api } = await adminPage(browser);
  try {
    await page.clock.install();
    const isSpatialGet = (route: Route): boolean => route.request().method() === 'GET' && spatialRe(projectId).test(new URL(route.request().url()).pathname);
    const isLayerPut = (route: Route): boolean => route.request().method() === 'PUT' && new URL(route.request().url()).pathname.endsWith('/spatial/layer');
    const gate = makeGate();
    let gateAlertText = '';

    await test.step('[28-B-001] held N15: skeleton rows and a loading rerun button', async () => {
      await page.route('**/api/projects/*/spatial', async (route) => {
        if (isSpatialGet(route)) {
          await gate.open;
          await route.continue();
        } else await route.fallback();
      });
      await page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' });
      // Table.Skeleton: 8 rows of `td colSpan={ROW_COLUMNS}` (5 columns)
      await expect(page.locator('td[colspan="5"]').first()).toBeVisible();
      await expect.soft(page.locator('td[colspan="5"]')).toHaveCount(8);
      await expect.soft(rerunButton(page), 'loading button is disabled').toBeDisabled();
      await expect.soft(levelFilter(page)).toHaveCount(0);
      await captureEvidence(page, 'E06r_28-B-001_skeleton.png');
    });

    await test.step('[28-F-009] held state at 1440 / 1024 / 768 / 375', async () => {
      for (const size of WIDTHS) {
        await page.setViewportSize(size);
        expect.soft(await noHorizontalScroll(page), `${String(size.width)} px: no horizontal scroll`).toBeLessThanOrEqual(0);
        const box = await page.locator('td[colspan="5"]').first().boundingBox();
        expect.soft((box?.x ?? 0) + (box?.width ?? 0), `${String(size.width)} px: skeleton fits the width`).toBeLessThanOrEqual(size.width + 1);
      }
      await page.setViewportSize(VIEWPORT);
      await captureEvidence(page, 'E06r_28-F-009_skeleton_widths.png');
      gate.release();
      await expect(levelFilter(page)).toBeVisible();
    });

    await test.step('[28-B-015] N15 500 on a fresh load: gate alert with "Thử lại", click recovers', async () => {
      await page.goto('about:blank'); // drop pending autosave retries of the former page before the routes change
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const failing = async (route: Route): Promise<void> => {
        if (isSpatialGet(route)) await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-06b mocked 500' }) });
        else await route.fallback();
      };
      await page.route('**/api/projects/*/spatial', failing);
      await page.goto(ROUTES.project.rules(projectId), { waitUntil: 'commit' });
      const alert = page.getByRole('alert').filter({ has: page.getByRole('button', { name: RR.retry, exact: true }) });
      await expect(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      gateAlertText = await alert.innerText();
      await page.unroute('**/api/projects/*/spatial', failing);
      await alert.getByRole('button', { name: RR.retry, exact: true }).click();
      await expect.soft(levelFilter(page)).toBeVisible();
      await expect.soft(alert).toHaveCount(0);
      await captureEvidence(page, 'E06r_28-B-015_gate_error.png');
    });

    await test.step('[28-G-008] wire: the 500 was N15 and the gate rendered it', async () => {
      const spatial = api.filter((entry) => entry.method === 'GET' && spatialRe(projectId).test(entry.path));
      expect.soft(spatial.some((entry) => entry.status === 500), 'a 500 on GET /spatial').toBe(true);
      expect.soft(spatial.at(-1)?.status, 'the retry answered 200').toBe(200);
      expect.soft(gateAlertText, 'the gate (not the report) showed it').not.toContain(RR.errorTitle);
      await captureEvidence(page, 'E06r_28-G-008_wire.png');
    });

    await test.step('[28-B-016] background refresh 500: inline alert above the report', async () => {
      let reads = 0;
      const second = async (route: Route): Promise<void> => {
        if (!isSpatialGet(route)) {
          await route.fallback();
          return;
        }
        reads += 1;
        if (reads === 1) await route.fallback();
        else await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-06b mocked 500' }) });
      };
      await page.route('**/api/projects/*/spatial', second);
      await openRules(page, projectId);
      // The gate re-mounts (staleTime 0) when the user leaves the screen and comes back: that refetch is the 500.
      await page.getByRole('link', { name: RR.settingsLink, exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Cài đặt bộ luật không gian', level: 2 })).toBeVisible();
      await page.goBack();
      const inline = page.getByText(RR.refreshFailed, { exact: true });
      await expect(inline).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect.soft(page.getByRole('button', { name: RR.retry, exact: true })).toBeVisible();
      await expect.soft(levelFilter(page), 'the report stays under the alert').toBeVisible();
      await page.unroute('**/api/projects/*/spatial', second);
      await page.getByRole('button', { name: RR.retry, exact: true }).click();
      await expect.soft(inline).toHaveCount(0);
      await captureEvidence(page, 'E06r_28-B-016_refresh_failed.png');
    });

    await test.step('[28V-G-005] PUT layer 422 (unnamed room): the blocked message', async () => {
      await page.goto('about:blank'); // drop pending autosave retries of the former page before the routes change
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      let puts = 0;
      await page.route('**/api/projects/*/floors/*/spatial/layer', async (route) => {
        if (!isLayerPut(route)) {
          await route.fallback();
          return;
        }
        puts += 1;
        await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify([{ path: ['rooms', 0, 'name'], message: 'String should have at least 1 character' }]) });
      });
      const sheet = await openRuleSheet(page, projectId, RULE_NAME.furnitureClash);
      await sheet.getByRole('button', { name: RR.deleteAction, exact: true }).click();
      await expect.poll(() => puts, { message: 'the autosave PUT reached the mock' }).toBeGreaterThanOrEqual(1);
      await expect.soft(page.getByRole('alert').filter({ hasText: RR.unnamedRoom })).toHaveCount(1);
      await captureEvidence(page, 'E06r_28V-G-005_unnamed_room.png');
    });

    await test.step('[28V-G-006] PUT aborted: offline label, retry after 5 s', async () => {
      await page.goto('about:blank'); // drop pending autosave retries of the former page before the routes change
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      let attempts = 0;
      await page.route('**/api/projects/*/floors/*/spatial/layer', async (route) => {
        if (!isLayerPut(route)) {
          await route.fallback();
          return;
        }
        attempts += 1;
        await route.abort('failed');
      });
      const sheet = await openRuleSheet(page, projectId, RULE_NAME.furnitureClash);
      await sheet.getByRole('button', { name: RR.deleteAction, exact: true }).click();
      await expect.poll(() => attempts).toBeGreaterThanOrEqual(1);
      // autosaveMessages.offline (vi.json autosave.offline), rendered by the sheet header's save label
      await expect(sheet.getByText(RR.offline)).toBeVisible();
      const first = attempts;
      await page.clock.fastForward(5_000); // retry ladder 5 s / 15 s / 45 s (useAutosave.ts)
      await expect.poll(() => attempts, { message: 'the second attempt after 5 s' }).toBeGreaterThan(first);
      await captureEvidence(page, 'E06r_28V-G-006_offline_retry.png');
    });

    await test.step('[28V-G-007] PUT 404 then 500: "Không lưu được thay đổi của tầng này."', async () => {
      for (const status of [404, 500] as const) {
        await page.goto('about:blank'); // drop pending autosave retries of the former page before the routes change
      await page.unrouteAll({ behavior: 'ignoreErrors' });
        let seen = 0;
        await page.route('**/api/projects/*/floors/*/spatial/layer', async (route) => {
          if (!isLayerPut(route)) {
            await route.fallback();
            return;
          }
          seen += 1;
          await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ detail: `qa-06b mocked ${String(status)}` }) });
        });
        const sheet = await openRuleSheet(page, projectId, RULE_NAME.furnitureClash);
        await sheet.getByRole('button', { name: RR.deleteAction, exact: true }).click();
        await expect.poll(() => seen, { message: `the autosave PUT reached the ${String(status)} mock` }).toBeGreaterThanOrEqual(1);
        await expect.soft(page.getByRole('alert').filter({ hasText: RR.saveUnknown }), `after PUT ${String(status)}`).toHaveCount(1);
        await captureEvidence(page, `E06r_28V-G-007_save_${String(status)}.png`);
        await expect(sheetOf(page)).toBeVisible();
      }
    });
  } finally {
    await context.close();
  }
});

