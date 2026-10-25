/**
 * Phase 4 — SCR-21 thickness, EDGE layer, MOCKED RESPONSES: one sequential flow (QA-04c P4, FL-21-M1, `[mocked response]`).
 * The N16 read (`GET …/floors/:f/spatial/layer`) is held, answered 500 after the first success, or the apply's PUT #35 is
 * answered 500 / aborted — none of which the shared stack can produce on demand. What is real: the project, its layer
 * (`thkMix`: 5 x 180 mm, 150 mm, 220 mm), the session and the page. Bản Z (S-21): tick a group, then "Đổi N đoạn". One `test.step('[<row id>] …')` per catalog row, in the
 * planned order. Pairs: BE4-G-218 (pytest), FL-A4-03 (A4 write happy path).
 *
 * Source (FE, this branch): TV src/screens/qc/ThicknessStandardization/ThicknessStandardization.tsx · UT …/useThicknessStandardization.ts ·
 * TH …/ThicknessHistogram.tsx · UFL src/hooks/useFloorLayer.ts · SLS src/lib/autosave/spatialLayerSave.ts (:258-265) ·
 * CA src/lib/http/ (retry ladder, 3 attempts on a network failure).
 *
 * Budget: 1 API login (beforeAll) + 1 flow session, 1 project, ≈ 6 page loads; N16 GETs: 1 held + refetches; PUT #35: the
 * apply attempts of [21-G-006] (500, abort) + the retry that succeeds.
 */
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { errorBody, holdFirst } from './support/p03/P4';
import { reseed, thkMix } from './support/p04/P4';

const SCREEN = 'Chuẩn hoá độ dày tường';
const EMPTY_TITLE = 'Chưa có đoạn tường nào để chuẩn hoá';
const RETRY_LADDER_MS = 60_000;

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const region = (page: Page): Locator => page.getByRole('region', { name: SCREEN, exact: true });
const button = (page: Page, name: string): Locator => region(page).getByRole('button', { name, exact: true });
const skeletonRows = (page: Page): Locator => page.locator('div.flex.items-center.gap-4.p-3.w-full:has(> .animate-pulse)');
const acceptBox = (page: Page): Locator => region(page).getByRole('checkbox', { name: /^Đồng ý đổi các đoạn 180 mm về 220 mm$/u }); // TBP:TEXT.acceptGroup
const toasts = (page: Page): Locator => page.getByRole('region', { name: 'Thông báo', exact: true });

test.describe('E04 SCR-21 thickness — mocked-response flow (QA-04c P4)', () => {
  test('SCR-21 · FL-21-M1 · [mocked response] held read, refetch error, loading is not empty, apply PUT 500 / abort', async ({ browser }) => {
    test.setTimeout(480_000);
    const built = await thkMix(adminApi, '21-M1');
    const floorId = built.floorIds[0] as string;
    const readPath = `/api/projects/${built.project.projectId}/floors/${floorId}/spatial/layer`;
    const url = ROUTES.project.thickness(built.project.projectId, floorId);
    const isRead = (u: URL, method: string): boolean => method === 'GET' && u.pathname === readPath;
    let flow: Flow | undefined;
    try {
      flow = await openFlow(browser, readAdminCredentials(), { reducedMotion: true });
      const { page } = flow;
      const answer = async (method: 'GET' | 'PUT', handler: (route: Route) => Promise<void>): Promise<() => Promise<void>> => {
        const matcher = (u: URL): boolean => u.pathname === readPath;
        const wrapped = async (route: Route): Promise<void> => (route.request().method() === method ? handler(route) : route.fallback());
        await page.route(matcher, wrapped);
        return () => page.unroute(matcher, wrapped);
      };

      await test.step('[21-B-001] loading: the histogram is aria-busy "Đang tải biểu đồ phân bố độ dày", four table-row skeletons', async () => {
        const hold = await holdFirst(page, isRead);
        try {
          await page.goto(url);
          await hold.seen;
          const busy = page.getByRole('region', { name: 'Đang tải biểu đồ phân bố độ dày', exact: true }); // TH:78,291-302
          await expect(busy).toHaveAttribute('aria-busy', 'true');
          await expect.soft(skeletonRows(page)).toHaveCount(4); // TV:SKELETON_ROWS
          await captureEvidence(page, 'E04_21-B-001_loading.png');
        } finally {
          await hold.release();
        }
        await expect(region(page).getByRole('checkbox', { name: /^Đồng ý đổi các đoạn / }).first()).toBeVisible();
        await expect.soft(skeletonRows(page)).toHaveCount(0);
      });

      await test.step('[21-B-007] a refetch that fails after data: the violation alert "Không đọc được lớp số đo độ dày", the tables stay', async () => {
        // Same trigger as SCR-17 17-B-013 / SCR-16 FL-16-M1: the app refetches a stale (> 30 s) layer query on reconnect while
        // the cached document is held. The earlier SPA hop never remounted the screen, so nothing refetched (log: 60 s timeout).
        // vitest useThicknessStandardization.test.ts [21-B-007] proves the screen shows the error with its rows kept.
        await page.clock.install(); // time flows; fastForward only makes the cached read stale without waiting
        await page.goto(url);
        await expect(acceptBox(page)).toBeVisible();
        let reads = 0;
        page.on('request', (request) => {
          if (request.method() === 'GET' && new URL(request.url()).pathname === readPath) reads += 1;
        });
        const stop = await answer('GET', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') }));
        try {
          await page.clock.fastForward(40_000);
          const before = reads;
          await page.evaluate(() => {
            window.dispatchEvent(new Event('offline'));
            window.dispatchEvent(new Event('online'));
          });
          await expect.poll(() => reads, { message: 'the layer read is refetched', timeout: 10_000 }).toBeGreaterThan(before);
          const alert = region(page).getByText('Không đọc được lớp số đo độ dày', { exact: true }); // TV:113,332-334, UT:854
          await expect(alert).toBeVisible({ timeout: RETRY_LADDER_MS });
          await expect.soft(region(page).getByText('Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', { exact: true })).toBeVisible();
          await expect.soft(region(page).getByRole('table').first()).toBeVisible();
          await expect.soft(region(page).locator('tbody tr').first()).toBeVisible();
          await captureEvidence(page, 'E04_21-B-007_refetch-error.png');
        } finally {
          await stop();
        }
      });

      await test.step('[21-B-009] ⚑ loading is never shown as empty (bản Z: no collapse toggle; the drawing is the main view)', async () => {
        const hold = await holdFirst(page, isRead);
        try {
          await page.goto(url);
          await hold.seen;
          await expect(skeletonRows(page)).toHaveCount(4);
          await expect.soft(page.getByRole('button', { name: 'Thu gọn khung xem trước', exact: true })).toHaveCount(0);
          await expect.soft(page.getByText(EMPTY_TITLE, { exact: true }), 'loading must not read as empty').toHaveCount(0);
          await captureEvidence(page, 'E04_21-B-009_loading-not-empty.png');
        } finally {
          await hold.release();
        }
        await expect(acceptBox(page)).toBeVisible();
      });

      await test.step('[21-G-006] the apply\'s PUT answers 500, then a network failure: the toast is already shown, the screen stays, a retry saves', async () => {
        const putsSeen: string[] = [];
        page.on('response', (response) => {
          if (response.request().method() === 'PUT' && new URL(response.url()).pathname === readPath) putsSeen.push(String(response.status()));
        });
        const apply = async (): Promise<void> => {
          if (!(await acceptBox(page).isChecked())) {
            await acceptBox(page).focus();
            await page.keyboard.press('Space');
          }
          await region(page).getByRole('button', { name: /^Đổi 5 đoạn/u }).click();
        };

        let stop = await answer('PUT', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') }));
        try {
          await apply();
          await expect.soft(toasts(page).getByText('Chuẩn hoá độ dày 5 tường.', { exact: true })).toBeVisible(); // SLS:258-265
          await expect.poll(() => putsSeen.length, { timeout: RETRY_LADDER_MS }).toBeGreaterThan(0);
          await expect.soft(region(page)).toBeVisible();
          await expect.soft(region(page).locator('tbody tr').first()).toBeVisible();
          await captureEvidence(page, 'E04_21-G-006_put-500.png');
        } finally {
          await stop();
        }
        // the toast sits over the screen's own "Hoàn tác" (pointer interception): press the toast's undo, same action
        await toasts(page).getByRole('button', { name: 'Hoàn tác', exact: true }).first().click();
        stop = await answer('PUT', (route) => route.abort('failed'));
        try {
          await apply();
          await expect.soft(toasts(page).getByText('Chuẩn hoá độ dày 5 tường.', { exact: true }).first()).toBeVisible(); // CA:186-205
          await captureEvidence(page, 'E04_21-G-006_put-abort.png');
        } finally {
          await stop();
        }
        const before = putsSeen.length;
        await page.keyboard.press('Control+S'); // the held write goes out again once the fault clears
        await expect.poll(() => putsSeen.slice(before).includes('200'), { timeout: RETRY_LADDER_MS, message: 'a retry after the fault clears answers 200' }).toBe(true);
        await attachJson('E04_21-G-006_puts.json', { putsSeen });
      });
    } finally {
      await closeFlow(flow as Flow);
      await deleteSeededProject(adminApi, built.project.projectId);
    }
  });
});
