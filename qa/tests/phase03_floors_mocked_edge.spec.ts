/**
 * Phase 3 — SCR-09 Floor Manager, branches the shared stack cannot produce (QA-03d P4, flow-plan.md
 * "phase03_floors_mocked_edge.spec.ts"). One test per flow, one `test.step('[<row id>] …')` per catalog row.
 *
 * Source (FE @ c16f2428): FM src/screens/qc/FloorManager/FloorManager.tsx · FT …/FloorTable.tsx · FSC …/FloorSectionCut.tsx
 * · UFM …/useFloorManager.ts · FMG …/floorManagerGateway.ts · NH src/components/feedback/NotificationHost.tsx (title — sentence)
 * · I18N src/i18n/vi.json `errors.*`.
 *
 * Mocks (each flow is "[mocked response]"; unpairable on the shared stack: 5xx / 403 / network failure on demand):
 *   FL-09-11 GET /api/projects/:id/floors 500, aborted; GET …/floors/:fid/spatial/layer 500. "Held" GETs are not mocks
 *            (the real request is delayed, then answered by the backend).
 *   FL-09-12 POST /api/projects/:id/floors 500 then aborted; DELETE /api/floors/:id 403; PATCH …/floors/:fid/spatial 500
 *            (the reorder PATCH itself is real). Every route is removed right after its step.
 *
 * Budget per run: logins 4 (per flow: admin API `signedInApi` + admin browser login, no shared session file); `POST /api/auth/refresh`
 * ≈ 1 per page load; `POST /api/projects` 2 (+2 DELETE in `finally`); real floor writes: 1 reorder + its
 * restack PATCHes (FL-09-12). No upload, no invitation, no mail.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { captureEvidence } from './support/evidence';
import { createProject, deleteSeededProject } from './support/phase03Seed';
import { adminApi, closePage, errorBody, floorRowNames, floorRows, holdFirst, openAdminPage, type OpenPage } from './support/p03/P4';

const FLOOR_LIST_ERROR = 'Không đọc được danh sách tầng'; // FT:77
const SECTION_REGION = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao'; // FSC
const SESSION_STRIP = 'Một số thay đổi chưa được lưu'; // FM:77
const CAPTION_MANUAL = 'Cao độ đang nhập tay; ô ghi "Ghi đè" khác cao độ tính từ các tầng dưới.'; // FT:83
const PERSIST_FAILED = 'Chưa lưu được thay đổi tầng'; // UFM:181
const SENTENCE = {
  server: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // I18N errors.unknown
  network: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.', // I18N errors.network
  forbidden: 'Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // I18N errors.forbidden
} as const;

const softExpect = expect.configure({ soft: true });
const toast = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });
const listAlert = (page: Page) => page.getByRole('alert').filter({ hasText: FLOOR_LIST_ERROR });

test.describe('SCR-09 floors — mocked responses', () => {
  test('SCR-09 · FL-09-11 · [mocked response] Floor list loading, reduced motion, 5xx, network and layer-read failures', async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, '09-b-001', 2);
      projectId = project.projectId;
      open = await openAdminPage(browser);
      const { page } = open;
      const floorsUrl = ROUTES.project.floors(projectId);
      const listPath = `/api/projects/${projectId}/floors`;
      const isList = (url: URL, method: string): boolean => method === 'GET' && url.pathname === listPath;

      await test.step('[09-B-001] held GET floors → table frame + 4 skeleton rows, pulsing cut, no toolbar/caption/footer; release → rows', async () => {
        const hold = await holdFirst(page, isList);
        try {
          await page.goto(floorsUrl);
          await hold.seen;
          const table = page.getByRole('table');
          await expect(table).toBeVisible();
          await expect(table.locator('tbody tr')).toHaveCount(4); // FT:263-265 Table.Skeleton rows=4
          await expect(page.getByRole('region', { name: SECTION_REGION }).locator('.animate-pulse')).toHaveCount(1); // FSC:163
          await expect.soft(page.getByRole('button', { name: 'Thêm tầng', exact: true })).toHaveCount(0); // FT:228
          await expect.soft(page.getByText(CAPTION_MANUAL, { exact: true })).toHaveCount(0); // FT:309
          await expect.soft(page.getByText(/^\d+ tầng · tổng cao /u)).toHaveCount(0);
          await expect(floorRows(page)).toHaveCount(0);
          await captureEvidence(page, 'E03_09-B-001_floors_loading.png');
        } finally {
          await hold.release();
        }
        await expect(floorRows(page)).toHaveCount(2);
      });

      await test.step('[09-E-016] reduced motion + held reload → skeleton without animation; release → rows', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const hold = await holdFirst(page, isList);
        try {
          await page.reload();
          await hold.seen;
          const pulsing = page.locator('.animate-pulse');
          await expect(pulsing.first()).toBeVisible();
          const animations = await pulsing.evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
          await captureEvidence(page, 'E03_09-E-016_floors_loading_reduced_motion.png', {
            caption: `prefers-reduced-motion: reduce · animation-name of .animate-pulse: ${animations.join(', ')}`,
          });
          expect.soft(animations.filter((name) => name !== 'none'), 'every skeleton pulse is off under reduced motion').toEqual([]);
        } finally {
          await hold.release();
        }
        await expect(floorRows(page)).toHaveCount(2);
        await page.emulateMedia({ reducedMotion: null });
      });

      await test.step('[09-B-006] GET floors 500 → alert + description, no cut, no session strip; unroute + "Thử lại" → rows', async () => {
        const handler = async (route: Route): Promise<void> => {
          if (route.request().method() !== 'GET') return route.fallback();
          await route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') });
        };
        const matcher = (url: URL): boolean => url.pathname === listPath;
        await page.route(matcher, handler);
        try {
          await page.goto(floorsUrl);
          const alert = listAlert(page);
          await expect(alert).toBeVisible();
          await expect.soft(alert).toContainText(SENTENCE.server);
          await expect.soft(page.getByRole('region', { name: SECTION_REGION })).toHaveCount(0); // FM:95
          await expect.soft(page.getByRole('heading', { name: SESSION_STRIP, exact: true })).toHaveCount(0); // FM:143
          await captureEvidence(page, 'E03_09-B-006_floors_list_500.png');
        } finally {
          await page.unroute(matcher, handler);
        }
        await listAlert(page).getByRole('button', { name: 'Thử lại', exact: true }).click(); // UFM onRetry → refetch
        await expect(floorRows(page)).toHaveCount(2);
      });

      await test.step('[09-B-007] GET floors aborted → alert with the network sentence', async () => {
        const handler = (route: Route): Promise<void> =>
          route.request().method() === 'GET' ? route.abort('failed') : route.fallback();
        const matcher = (url: URL): boolean => url.pathname === listPath;
        await page.route(matcher, handler);
        try {
          await page.goto(floorsUrl);
          const alert = listAlert(page);
          await expect(alert).toBeVisible({ timeout: 20_000 }); // GET retries a network failure 3× (lib/http/retry.ts)
          await expect.soft(alert).toContainText(SENTENCE.network);
          await captureEvidence(page, 'E03_09-B-007_floors_list_network.png');
        } finally {
          await page.unroute(matcher, handler);
        }
      });

      await test.step('[09-B-008] one floor\'s GET …/spatial/layer 500 → the whole screen in the list error state', async () => {
        const first = project.floors[0];
        if (first === undefined) throw new Error('seed: no floor');
        const layerPath = `/api/projects/${projectId}/floors/${first.id}/spatial/layer`;
        const handler = async (route: Route): Promise<void> => {
          if (route.request().method() !== 'GET') return route.fallback();
          await route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') });
        };
        const matcher = (url: URL): boolean => url.pathname === layerPath;
        await page.route(matcher, handler);
        try {
          await page.goto(floorsUrl);
          await expect.soft(listAlert(page)).toBeVisible({ timeout: 20_000 }); // FMG readProjectLayerRead (Promise.all)
          await expect.soft(floorRows(page)).toHaveCount(0);
          await captureEvidence(page, 'E03_09-B-008_floors_layer_500.png');
        } finally {
          await page.unroute(matcher, handler);
        }
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });

  test('SCR-09 · FL-09-12 · [mocked response] Persist failures: add 5xx, add offline, delete 403, reorder\'s later PATCH 5xx', async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let open: OpenPage | undefined;
    let projectId = '';
    try {
      const project = await createProject(admin, '09-b-017', 3);
      projectId = project.projectId;
      open = await openAdminPage(browser);
      const { page } = open;
      const floorsPath = `/api/projects/${projectId}/floors`;
      const names = project.floors.map((floor) => floor.name);
      await page.goto(ROUTES.project.floors(projectId));
      await expect(floorRows(page)).toHaveCount(3);
      const add = page.getByRole('button', { name: 'Thêm tầng', exact: true });

      /** Routes `method` on `matcher` with `answer` until the returned `off()` is called. */
      const failing = async (matcher: (url: URL) => boolean, method: string, answer: (route: Route) => Promise<void>) => {
        const handler = (route: Route): Promise<void> => (route.request().method() === method ? answer(route) : route.fallback());
        await page.route(matcher, handler);
        return { off: () => page.unroute(matcher, handler) };
      };

      await test.step('[09-B-017] "Thêm tầng" with POST 500 → the new row is rolled back; toast "Chưa lưu được thay đổi tầng — …"', async () => {
        const mock = await failing((url) => url.pathname === floorsPath, 'POST', (route) =>
          route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') }),
        );
        try {
          await add.click();
          await expect(toast(page, PERSIST_FAILED).first()).toBeVisible({ timeout: 15_000 });
          await expect(floorRows(page)).toHaveCount(3);
          await captureEvidence(page, 'E03_09-B-017_floors_add_500.png');
        } finally {
          await mock.off();
        }
      });

      await test.step('[09-B-031] the 5xx sentence is "… — Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút."', async () => {
        await expect.soft(toast(page, `${PERSIST_FAILED} — ${SENTENCE.server}`).first()).toBeVisible();
      });

      await test.step('[09-B-030] "Thêm tầng" with POST aborted → network sentence; rollback', async () => {
        const mock = await failing((url) => url.pathname === floorsPath, 'POST', (route) => route.abort('failed'));
        try {
          await add.click();
          await expect.soft(toast(page, `${PERSIST_FAILED} — ${SENTENCE.network}`).first()).toBeVisible({ timeout: 15_000 });
          await expect.soft(floorRows(page)).toHaveCount(3);
          await captureEvidence(page, 'E03_09-B-030_floors_add_network.png');
        } finally {
          await mock.off();
        }
      });

      await test.step('[09-B-033] "Xoá tầng" with DELETE 403 → the row comes back; forbidden sentence', async () => {
        const target = names[2];
        if (target === undefined) throw new Error('seed: fewer than 3 floors');
        const mock = await failing((url) => /^\/api\/floors\/[^/]+$/u.test(url.pathname), 'DELETE', (route) =>
          route.fulfill({ status: 403, contentType: 'application/json', body: errorBody('FORBIDDEN') }),
        );
        try {
          await page.getByRole('button', { name: `Thao tác khác cho tầng ${target}`, exact: true }).click();
          await page.getByRole('menuitem', { name: 'Xoá tầng', exact: true }).click();
          await expect.soft(toast(page, `${PERSIST_FAILED} — ${SENTENCE.forbidden}`).first()).toBeVisible({ timeout: 15_000 });
          await softExpect.poll(() => floorRowNames(page)).toEqual(names);
          await captureEvidence(page, 'E03_09-B-033_floors_delete_403.png');
        } finally {
          await mock.off();
        }
      });

      await test.step('[09-B-023] Alt+ArrowUp: reorder 200, first PATCH spatial 500 → new order kept (no rollback), failure toast only', async () => {
        const [bottom, middle] = names;
        if (bottom === undefined || middle === undefined) throw new Error('seed: fewer than 3 floors');
        let patched = 0;
        const mock = await failing((url) => new RegExp(`^${floorsPath}/[^/]+/spatial$`, 'u').test(url.pathname), 'PATCH', async (route) => {
          patched += 1;
          if (patched === 1) await route.fulfill({ status: 500, contentType: 'application/json', body: errorBody('INTERNAL') });
          else await route.fallback();
        });
        try {
          const reorder = waitForApi(page, 'PATCH', /^\/api\/floors\/reorder$/u, [200]);
          await page.getByRole('row', { name: new RegExp(`^${middle}, cao độ `, 'u') }).focus();
          await page.keyboard.press('Alt+ArrowUp');
          await reorder;
          const swapped = [middle, bottom, ...names.slice(2)];
          await expect.soft(toast(page, `${PERSIST_FAILED} — ${SENTENCE.server}`).first()).toBeVisible({ timeout: 15_000 });
          await softExpect.poll(() => floorRowNames(page)).toEqual(swapped);
          await captureEvidence(page, 'E03_09-B-023_floors_reorder_patch_500.png', { caption: `PATCH …/spatial answered by the mock: ${String(patched)}` });
          expect.soft(patched, 'the reorder step sends at least one PATCH …/spatial after PATCH /floors/reorder').toBeGreaterThan(0);
        } finally {
          await mock.off();
        }
      });
    } finally {
      await closePage(open);
      if (projectId !== '') await deleteSeededProject(admin, projectId);
      await admin.dispose();
    }
  });
});
