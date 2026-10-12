/**
 * Phase 4 — SCR-19 axes, EDGE layer, MOCKED RESPONSES: one sequential flow (QA-04c P4, FL-19-M1, `[mocked response]`).
 * The first N16 read (`GET …/floors/:f/spatial/layer`) is held, or answered 403 / 500 / aborted, because none of those
 * can be produced on the shared stack (a 5xx would need a corrupt layer; 403 needs a revoked role mid-flow). What is real:
 * the project, its layer (the rectangle of FL-19-01), the session and the page. One `test.step('[<row id>] …')` per catalog
 * row, in the planned order. Pairs: BE4-G-305 (pytest, corrupt layer -> 500), FL-A4-08 (A4 roles).
 *
 * Source (FE, this branch): AGV src/screens/qc/AxisGridManager/AxisGridManager.tsx · UAG …/useAxisGridManager.ts ·
 * FLR src/screens/qc/shared/floorLayerReadFailure.ts · FLS …/FloorLayerReadFailureScreen.tsx · I18N src/i18n/vi.json (`errors.*`).
 *
 * Budget: 1 API login (beforeAll) + 1 flow session, 1 project, ≈ 8 page loads (refresh each), N16 GETs: 1 held + up to 3
 * retries per failing step (lib/http/retry.ts) — all on this flow's own project.
 */
import { expect, test, type APIRequestContext, type Locator, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { errorBody, holdFirst } from './support/p03/P4';
import { gridsRect } from './support/p04/P4';

const SCREEN = 'Quản lý trục và gốc toạ độ';
const RETRY = 'Thử lại';
const SENTENCE = {
  forbidden: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // I18N errors.forbidden
  server: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown
  network: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // I18N errors.network
} as const;
/** A GET failing with a network error or 5xx is retried 3x by the HTTP layer (lib/http/retry.ts): allow for the ladder. */
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
const listbox = (page: Page, name: string): Locator => page.getByRole('listbox', { name, exact: true });
const failure = (page: Page): Locator => page.getByRole('alert').filter({ has: page.getByRole('button', { name: RETRY, exact: true }) });
const skeletonRows = (page: Page): Locator => page.locator('div.flex.items-center.gap-4.p-3.w-full:has(> .animate-pulse)');

test.describe('E04 SCR-19 axes — mocked-response flow (QA-04c P4)', () => {
  test('SCR-19 · FL-19-M1 · [mocked response] held read, 403, 500, abort, retry', async ({ browser }) => {
    test.setTimeout(420_000);
    const built = await gridsRect(adminApi, '19-M1');
    const layerPath = `/api/projects/${built.project.projectId}/floors/${built.floorIds[0] as string}/spatial/layer`;
    const url = ROUTES.project.grids(built.project.projectId, built.floorIds[0] as string);
    const isRead = (u: URL, method: string): boolean => method === 'GET' && u.pathname === layerPath;
    let flow: Flow | undefined;
    try {
      flow = await openFlow(browser, readAdminCredentials());
      const { page } = flow;

      /** Answers every N16 read with `answer` until the returned `stop()`. */
      const answer = async (handler: (route: Route) => Promise<void>): Promise<() => Promise<void>> => {
        const matcher = (u: URL): boolean => u.pathname === layerPath;
        const wrapped = async (route: Route): Promise<void> => (route.request().method() === 'GET' ? handler(route) : route.fallback());
        await page.route(matcher, wrapped);
        return () => page.unroute(matcher, wrapped);
      };

      await test.step('[19-B-001] loading: six skeleton rows in the left column, the canvas frame is drawn, no listbox', async () => {
        const hold = await holdFirst(page, isRead);
        try {
          await page.goto(url);
          await hold.seen;
          await expect(region(page)).toBeVisible();
          await expect(skeletonRows(page)).toHaveCount(6); // AGV:113-114,166-174; UAG:448
          await expect.soft(listbox(page, 'Trục ngang')).toHaveCount(0);
          await expect.soft(page.locator('svg[role="img"]')).toHaveCount(1); // canvas frame is drawn while loading
          await captureEvidence(page, 'E04_19-B-001_loading-skeleton.png');
        } finally {
          await hold.release();
        }
        await expect(listbox(page, 'Trục ngang')).toBeVisible();
        await expect.soft(skeletonRows(page)).toHaveCount(0);
      });

      await test.step('[19-G-006] N16 403: "Không có quyền" with "Thử lại"', async () => {
        const stop = await answer((route) => route.fulfill({ status: 403, contentType: 'application/json', body: errorBody('FORBIDDEN') }));
        try {
          await page.goto(url);
          const alert = failure(page);
          await expect(alert).toBeVisible({ timeout: RETRY_LADDER_MS });
          await expect.soft(alert.getByRole('heading', { name: 'Không có quyền', exact: true })).toBeVisible(); // FLR:73-75
          await expect.soft(alert).toContainText(SENTENCE.forbidden);
          await captureEvidence(page, 'E04_19-G-006_read-403.png');
        } finally {
          await stop();
        }
      });

      await test.step('[19-G-007] N16 500: "Có trục trặc" with "Thử lại"', async () => {
        const stop = await answer((route) => route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') }));
        try {
          await page.goto(url);
          const alert = failure(page);
          await expect(alert).toBeVisible({ timeout: RETRY_LADDER_MS });
          await expect.soft(alert.getByRole('heading', { name: 'Có trục trặc', exact: true })).toBeVisible();
          await expect.soft(alert).toContainText(SENTENCE.server);
          await captureEvidence(page, 'E04_19-G-007_read-500.png');
        } finally {
          await stop();
        }
      });

      await test.step('[19-G-008] N16 network abort: "Mất kết nối" with "Thử lại"', async () => {
        const stop = await answer((route) => route.abort('failed'));
        try {
          await page.goto(url);
          const alert = failure(page);
          await expect(alert).toBeVisible({ timeout: RETRY_LADDER_MS });
          await expect.soft(alert.getByRole('heading', { name: 'Mất kết nối', exact: true })).toBeVisible();
          await expect.soft(alert).toContainText(SENTENCE.network);
          await captureEvidence(page, 'E04_19-G-008_read-abort.png');
        } finally {
          await stop();
        }
      });

      await test.step('[19-G-009] "Thử lại" after a transient failure re-reads and shows the grid', async () => {
        const stop = await answer((route) => route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') }));
        try {
          await page.goto(url);
          await expect(failure(page)).toBeVisible({ timeout: RETRY_LADDER_MS });
        } finally {
          await stop(); // the fault clears
        }
        const mark = flow?.log.length ?? 0;
        await failure(page).getByRole('button', { name: RETRY, exact: true }).click(); // FLR:75
        await expect(listbox(page, 'Trục ngang')).toBeVisible();
        const reads = (flow?.log ?? []).slice(mark).filter((entry) => entry.method === 'GET' && entry.path === layerPath);
        expect.soft(reads.map((entry) => entry.status), 'the second GET answers 200').toContain(200);
        await expect.soft(listbox(page, 'Trục dọc')).toBeVisible();
        await captureEvidence(page, 'E04_19-G-009_retry-ok.png');
      });
    } finally {
      await closeFlow(flow as Flow);
      await deleteSeededProject(adminApi, built.project.projectId);
    }
  });
});
