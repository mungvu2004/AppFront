/**
 * Phase 8 — SCR-34 Model Library, EDGE, MOCKED RESPONSES (QA-08 P3): FL-34L-M1..M3. Mocks mutate the real answer
 * (support/p08/P3.ts). Paired real flows: FL-34L-01 (M1), FL-34L-04 (M2), FL-34L-05 (M3). Viewport 1440.
 * Sources: ML ModelLibrary.tsx, MLB ModelLibraryTable.tsx, MLD ModelLibraryDetail.tsx, MLS ModelLibraryStats, UML useModelLibrary.ts.
 * Request budget: 1 admin API login + 3 admin UI sign-ins + 1 engineer UI sign-in (shared pool user `p08-eng`, no invitation).
 */
import { expect, test, type Page, type Route } from '@playwright/test';

import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { DESKTOP, ROUTES, adminApi } from './support/p08/admin';
import { craftedLibrary, deferred, fail500, failWith, fulfilEdited, itemsOf, readJson } from './support/p08/P3';
import { poolUser, signInPoolUser } from './support/phase03Seed';

const LIST = /\/api\/library(\?.*)?$/u;
const DETAIL_RE = /\/api\/library\/[^/?]+(\?.*)?$/u;
const ALERT = 'Không tải được thư viện model';
const err = (status: 403 | 404 | 429 | 500) => (route: Route) => failWith(route, status);

type Mode = 'real' | 'hold' | 'empty' | '500' | 'abort' | 'bad' | '403' | '429';
/** One persistent GET /api/library handler; `state.mode` picks the answer, `state.gate` holds it. */
async function mockList(page: Page): Promise<{ mode: Mode; gate: Promise<void> }> {
  const state = { mode: 'real' as Mode, gate: Promise.resolve() };
  await page.route(LIST, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (state.mode === 'hold') await state.gate;
    switch (state.mode) {
      case 'empty':
        return fulfilEdited(route, (b) => {
          b.items = [];
          delete b.nextCursor;
        });
      case '500':
        return fail500(route);
      case 'abort':
        return route.abort('failed');
      case 'bad':
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unexpected: true }) });
      case '403':
        return err(403)(route);
      case '429':
        return err(429)(route);
      default:
        return route.fallback();
    }
  });
  return state;
}

const alertOf = (page: Page) => page.getByText(ALERT, { exact: true });

test.describe('P08 SCR-34 library mocked edge', () => {
  test.use({ viewport: DESKTOP });

  test('SCR-34 · FL-34L-M1 · [mocked response] list read failures (500, abort, bad shape, 403, 429), loading hold, empty library, engineer 500 and loading; then real list', async ({ page, browser }) => {
    test.setTimeout(150_000);
    await signInAdmin(page, ROUTES.library);
    const state = await mockList(page);
    const reload = async (mode: Mode): Promise<void> => {
      state.mode = mode;
      await page.goto(ROUTES.library);
    };
    const eng = await browser.newContext({ viewport: DESKTOP });
    const admin = await adminApi();
    try {
      await test.step('[34L-B-001] Loading: 6-column table, 10 skeleton rows (held GET)', async () => {
        const g = deferred();
        state.gate = g.promise;
        await reload('hold');
        await expect(page.locator('[aria-busy="true"]').first()).toBeVisible(); // ML:61-83
        await captureEvidence(page, 'E08_34L-B-001_loading');
        g.resolve();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      });
      await test.step('[34L-B-002] Empty library: EmptyState replaces toolbar and table', async () => {
        await reload('empty');
        await expect.soft(page.getByText('Chưa có model nào', { exact: true })).toBeVisible(); // ML:39-40,85-91
        await expect.soft(page.getByText('Thư viện chưa có model nào.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_34L-B-002_empty');
      });
      await test.step('[34L-B-003] List 500: alert in place of the screen body', async () => {
        await reload('500');
        await expect.soft(alertOf(page)).toBeVisible(); // ML:93-99
        await expect.soft(page.getByRole('alert')).toBeVisible();
        await captureEvidence(page, 'E08_34L-B-003_500');
      });
      await test.step('[34L-B-004] ⚑ Read error offers a retry that refetches the list', async () => {
        const retryBtn = page.getByRole('button', { name: 'Thử lại', exact: true });
        await expect.soft(retryBtn).toBeVisible(); // UML:570-572 exists, ML:93-99 never renders it
        if ((await retryBtn.count()) > 0) {
          state.mode = 'real';
          const again = page.waitForResponse((r) => r.request().method() === 'GET' && LIST.test(r.url()));
          await retryBtn.click();
          expect.soft((await again).status(), 'retry refetches GET /api/library').toBe(200);
        }
        await captureEvidence(page, 'E08_34L-B-004_retry');
      });
      await test.step('[34L-B-005] List network failure (aborted): alert, no toolbar', async () => {
        await reload('abort');
        await expect.soft(alertOf(page)).toBeVisible();
        await expect.soft(page.getByLabel('tìm model', { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E08_34L-B-005_abort');
      });
      await test.step('[34L-B-006] Wrong shape fails FE decode: read error, not a crash', async () => {
        await reload('bad');
        await expect.soft(alertOf(page)).toBeVisible(); // client.ts:1086-1088 decodeList
        await captureEvidence(page, 'E08_34L-B-006_badshape');
      });
      const eUser = await poolUser(admin, 'engineer', 'p08-eng');
      await signInPoolUser(eng, eUser);
      const ePage = await eng.newPage();
      const eState = await mockList(ePage);
      await test.step('[34L-B-031] Engineer sees the loading skeleton while the list loads', async () => {
        const g = deferred();
        eState.gate = g.promise;
        eState.mode = 'hold';
        await ePage.goto(ROUTES.library);
        await expect.soft(ePage.locator('[aria-busy="true"]').first()).toBeVisible(); // ML:61
        await captureEvidence(ePage, 'E08_34L-B-031_engineer_loading');
        g.resolve();
      });
      await test.step('[34L-B-032] ⚑ Engineer, list read fails: error alert is shown', async () => {
        eState.mode = '500';
        await ePage.goto(ROUTES.library);
        await expect.soft(alertOf(ePage)).toBeVisible(); // UML:505-510 returns forbidden first
        await captureEvidence(ePage, 'E08_34L-B-032_engineer_500');
      });
      await test.step('[34L-G-004] List 403: read-error alert', async () => {
        await reload('403');
        await expect.soft(alertOf(page)).toBeVisible();
        await captureEvidence(page, 'E08_34L-G-004_403');
      });
      await test.step('[34L-G-005] List 429: read-error alert', async () => {
        await reload('429');
        await expect.soft(alertOf(page)).toBeVisible();
        await captureEvidence(page, 'E08_34L-G-005_429');
      });
      state.mode = 'real';
      await page.goto(ROUTES.library);
      await expect(page.getByLabel('tìm model', { exact: true })).toBeVisible(); // ends on a real answer
    } finally {
      await eng.close();
      await admin.dispose();
    }
  });

  test('SCR-34 · FL-34L-M2 · [mocked response] heavy and preview-less items', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAdmin(page, ROUTES.library);
    const api = await adminApi();
    let crafted: Record<string, unknown>[] = [];
    let listGets = 0;
    let detailGets = 0;
    try {
      crafted = craftedLibrary(itemsOf(await readJson(api, '/api/library')));
    } finally {
      await api.dispose();
    }
    await page.route(LIST, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      listGets += 1;
      return fulfilEdited(route, (b) => {
        b.items = crafted;
        delete b.nextCursor;
      });
    });
    await page.route(DETAIL_RE, async (route) => {
      if (route.request().method() !== 'GET' || LIST.test(route.request().url())) return route.fallback();
      detailGets += 1;
      const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
      const item = crafted.find((c) => c.id === id);
      return item === undefined ? route.fallback() : route.fulfill({ json: item });
    });
    await page.goto(ROUTES.library);
    const row = (name: string) => page.getByRole('row').filter({ hasText: name }).or(page.getByRole('listitem').filter({ hasText: name })).first();
    const retryBtn = page.getByRole('button', { name: 'Thử tải lại ảnh xem trước của QA preview-less model', exact: true });
    await test.step('[34L-B-014] Row without previewUrl: placeholder + retry button', async () => {
      await expect(row('QA preview-less model')).toBeVisible();
      await expect(retryBtn).toBeVisible(); // MLB:40,66-76
      await captureEvidence(page, 'E08_34L-B-014_nopreview');
    });
    await test.step('[34L-B-015] Item over the triangle cap: "Nặng" badge in the row', async () => {
      await expect.soft(row('QA heavy model 900001').getByText('Nặng', { exact: true })).toBeVisible(); // MLB:244-248
      await expect.soft(row('QA heavy model 900000').getByText('Nặng', { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E08_34L-B-015_heavy_badge');
    });
    await test.step('[34L-B-016] Heavy count figure is attention-coloured', async () => {
      await expect.soft(page.locator('[class*="text-state-attention-text"]').filter({ hasText: /\d/u }).first()).toBeVisible(); // MLS:42
      await captureEvidence(page, 'E08_34L-B-016_heavy_figure');
    });
    await test.step('[34L-B-017] Detail of a heavy model: "Cảnh báo model nặng"', async () => {
      await row('QA heavy model 900001').getByRole('button').filter({ hasText: /\S/u }).first().click();
      const aside = page.locator('aside[aria-label="Chi tiết model"]');
      await expect.soft(aside.getByText('Cảnh báo model nặng', { exact: false })).toBeVisible(); // MLD:257-266
      await expect.soft(aside.getByText('Nặng', { exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E08_34L-B-017_heavy_detail');
      await page.keyboard.press('Escape');
    });
    await test.step('[34L-C-009] Heavy count = rows over 900.000 triangles', async () => {
      const heavy = crafted.filter((c) => Number(c.triangleCount) > 900000).length;
      await expect.soft(page.getByText(String(heavy), { exact: true }).first()).toBeVisible(); // budget.ts:92-95
      await captureEvidence(page, 'E08_34L-C-009_heavy_count');
    });
    await test.step('[34L-E-011] Retry button has a per-row name; thumbnails decorative', async () => {
      await expect.soft(retryBtn).toHaveAttribute('aria-label', 'Thử tải lại ảnh xem trước của QA preview-less model'); // MLB:40,58,68
      await expect.soft(page.locator('table img').first()).toHaveAttribute('alt', '');
      await captureEvidence(page, 'E08_34L-E-011_labels');
    });
    await test.step('[34L-G-009] Retry-preview click refetches list and detail', async () => {
      const l0 = listGets;
      const d0 = detailGets;
      await retryBtn.click();
      await expect.poll(() => listGets - l0, { message: 'GET /api/library again' }).toBeGreaterThanOrEqual(1);
      await expect.poll(() => detailGets - d0, { message: 'GET /api/library/:id' }).toBeGreaterThanOrEqual(1); // UML:564-569
      await captureEvidence(page, 'E08_34L-G-009_retry_refetch');
    });
    await test.step('[34L-G-010] Item without preview_url decodes to a placeholder row', async () => {
      await expect.soft(row('QA preview-less model')).toBeVisible();
      await expect.soft(page.getByRole('alert')).toHaveCount(0);
      await captureEvidence(page, 'E08_34L-G-010_partial');
    });
  });

  test('SCR-34 · FL-34L-M3 · [mocked response] detail pending/404/500, in-flight close, failed GLB then real retry', async ({ page }) => {
    test.setTimeout(120_000);
    await signInAdmin(page, ROUTES.library);
    await page.goto(ROUTES.library);
    const first = page.locator('tbody td:nth-child(2) button, ul li button').filter({ hasText: /\S/u }).first();
    await expect(first).toBeVisible();
    const name = (await first.innerText()).trim();
    const aside = page.locator('aside[aria-label="Chi tiết model"]');
    const h2 = aside.getByRole('heading', { level: 2, name, exact: true });
    const close = aside.getByRole('button', { name: 'Đóng panel chi tiết model' });
    const retry = aside.getByRole('button', { name: 'Thử lại', exact: true });
    const GLB = /\.(glb|gltf)(\?.*)?$/u;
    const detail = async (mode: 'hold' | '404' | '500', gate: Promise<void> = Promise.resolve()): Promise<void> => {
      await page.route(DETAIL_RE, async (route) => {
        if (route.request().method() !== 'GET' || LIST.test(route.request().url())) return route.fallback();
        if (mode === 'hold') {
          await gate;
          return route.fallback();
        }
        return err(Number(mode) as 404 | 500)(route);
      });
    };

    await test.step('[34L-B-025] Preview failed (GLB aborted): overlay with error text and "Thử lại"', async () => {
      await page.route(GLB, (route) => route.abort('failed'));
      await first.click();
      await expect(aside).toBeVisible();
      await expect(retry).toBeVisible(); // MLD:118-142
      await captureEvidence(page, 'E08_34L-B-025_glb_failed');
    });
    await test.step('[34L-B-026] "Thử lại" reopens the same model and the preview loads', async () => {
      await page.unroute(GLB);
      await retry.click();
      await expect.soft(retry).toHaveCount(0);
      await expect.soft(aside.locator('canvas')).toBeVisible();
      await expect.soft(aside.getByRole('button', { name: 'Đo lại từ tệp' })).toBeVisible(); // MLD:134
      await captureEvidence(page, 'E08_34L-B-026_retry_ok');
      await close.click();
    });
    await test.step('[34L-B-027] Detail panel shows the list item while GET :id is pending', async () => {
      const g = deferred();
      await detail('hold', g.promise);
      await first.click();
      await expect.soft(h2).toBeVisible(); // UML:422-428
      await captureEvidence(page, 'E08_34L-B-027_pending');
      g.resolve();
      await page.unroute(DETAIL_RE);
      await close.click();
    });
    const keepsListData = async (mode: '404' | '500', ev: string): Promise<void> => {
      await detail(mode);
      await first.click();
      await expect.soft(h2).toBeVisible();
      await captureEvidence(page, ev);
      await page.unroute(DETAIL_RE);
      await close.click();
    };
    await test.step('[34L-G-006] Detail 404: panel keeps the list data', async () => {
      await keepsListData('404', 'E08_34L-G-006_detail_404');
    });
    await test.step('[34L-G-007] Detail 500: same fallback', async () => {
      await keepsListData('500', 'E08_34L-G-007_detail_500');
    });
    await test.step('[34L-G-008] Closing the detail while GET :id is in flight aborts it', async () => {
      const g = deferred();
      await detail('hold', g.promise);
      const aborted = page.waitForEvent('requestfailed', { predicate: (r) => DETAIL_RE.test(r.url()) && !LIST.test(r.url()), timeout: 10_000 });
      await first.click();
      await expect(aside).toBeVisible();
      await close.click(); // UML:344-354 signal
      await expect.soft(aborted, 'the in-flight GET :id was cancelled').resolves.toBeTruthy();
      await expect.soft(aside).toHaveCount(0);
      await captureEvidence(page, 'E08_34L-G-008_inflight_close');
      g.resolve();
      await page.unroute(DETAIL_RE);
    });
  });
});
