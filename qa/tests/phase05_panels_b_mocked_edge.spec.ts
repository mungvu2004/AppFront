/**
 * Phase 5 — SCR-23H "Lịch sử thao tác" side panel of Pascal `/projects/:p/3d`, EDGE layer, MOCKED RESPONSES: one flow
 * (QA-05c `flows-C3.md` "phase05_panels-b_mocked_edge.spec.ts"; file named with `_b_` because `qa/playwright.config.ts`
 * `testMatch` /phase\d{2}_[a-z0-9_]+\.spec\.ts$/ does not take a hyphen). One `test.step('[<row id>] …')` per row;
 * evidence `E05_<row id>_<slug>.png`; ⚑ = correct behaviour, red while the bug lives.
 *
 * Mocks (static assets, not API — unpairable on the real stack as network faults): `pascal-mount.js` held then aborted, every
 * new `.js` chunk held / aborted. Real pair: FL-23H-01 steps 3-4 (real chunk, real rail) and e2e/pascal-viewer.spec.ts:703
 * (real PASCAL-01). Real: the project (Q1, `layerSeed.createQcProject`), #24, N15, auth.
 *
 * Budget: `POST /api/auth/login` 1 admin API + 2 sessions (step 4 needs a fresh context = empty module cache) = 3;
 * `POST /api/projects` 1, #35 PUT 1, `DELETE` 1; `POST /api/auth/refresh` ≈ 1 per page load (4 loads).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi } from './support/layerSeed';
import {
  PASCAL_BUNDLE_GLOB,
  PASCAL_RENDER_TIMEOUT_MS,
  T,
  abortRoute,
  adminWho,
  canvasBox,
  caption,
  cleanupProjects,
  closeSession,
  historyPanel,
  historyRegion,
  historyTab,
  holdPascalBundle,
  holdRoute,
  openPascal,
  openSession,
  rail,
  type Session,
} from './support/p05/P2';

let admin: APIRequestContext;
let api: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  admin = await signedInApi(email, password);
  api = { request: admin, headers: {} };
});

test.afterAll(async () => {
  await admin?.dispose();
});

/** A new JS chunk of the app (not the Pascal bundle tree, which has its own routes). */
const appChunk = (url: string): boolean => {
  const path = new URL(url).pathname;
  return path.endsWith('.js') && !path.startsWith('/assets/pascal/');
};

test('SCR-23 · FL-23H-05 · [mocked response] Pascal đang nạp / lỗi và chunk bảng chậm / hỏng', async ({ browser }) => {
  test.setTimeout(Math.max(120_000, 2 * 45_000));
  const [floor] = await createQcProject(api, '23h-05');
  if (floor === undefined) throw new Error('setup: Q1 has no floor');
  const pid = floor.projectId;
  const sessions: Session[] = [];
  try {
    const s = await openSession(browser, adminWho());
    sessions.push(s);
    const { page } = s;
    const bundle = await holdPascalBundle(page);
    let chunks: Awaited<ReturnType<typeof holdRoute>> | undefined;

    await test.step('[23H-B-014] Pascal still loading: the rail is there and the tab opens the panel over the skeleton', async () => {
      await openPascal(page, pid, { wait: false });
      await expect(caption(page), 'PVT:118').toHaveText(T.loading);
      await expect(rail(page), 'PV:247-275 the column exists in loading').toBeVisible();
      // Hold every NEW app chunk before the click (step 2 needs the fallback): released at the end of step 2.
      chunks = await holdRoute(page, '**/*.js', (r) => appChunk(r.url()));
      await historyTab(page).click();
      await expect(historyRegion(page)).toBeVisible();
      await captureEvidence(page, 'E05_23H-B-014_panel-while-loading.png', { caption: 'pascal-mount.js held; tab clicked during loading' });
    });

    await test.step('[23H-B-001] slow panel chunk → "Đang mở bảng…" in the region, then section "Lịch sử chỉnh sửa"', async () => {
      await expect.soft(historyRegion(page).getByText(T.panelFallback, { exact: true }), 'PVC:287 Suspense fallback').toBeVisible();
      await captureEvidence(page, 'E05_23H-B-001_panel-fallback.png', { caption: `${String(chunks?.hits.length ?? 0)} app chunk(s) held` });
      await chunks?.dispose();
      await expect.soft(historyPanel(page)).toBeVisible({ timeout: 15_000 });
      await bundle.dispose();
    });

    await test.step('[23H-B-013] PASCAL-01 → "Không nạp được khung dựng hình" + "Thử lại", no rail', async () => {
      const lost = await abortRoute(page, PASCAL_BUNDLE_GLOB);
      await page.reload();
      await expect.soft(page.getByRole('heading', { name: T.errorTitle, exact: true }), 'PV:202-216').toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect.soft(page.getByRole('button', { name: T.retry, exact: true })).toBeVisible();
      await expect.soft(rail(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_23H-B-013_pascal-01-no-rail.png', { caption: `pascal-mount.js aborted ×${String(lost.hits.length)}` });
      await lost.dispose();
    });

    await test.step('[23H-B-011] ⚑ panel chunk lost → only the panel reports it; the 3D screen stays', async () => {
      const fresh = await openSession(browser, adminWho());
      sessions.push(fresh);
      const p = fresh.page;
      await openPascal(p, pid);
      const lost = await abortRoute(p, '**/*.js', { filter: (r) => appChunk(r.url()) });
      await historyTab(p).click();
      // Mốc: the chunk request was really aborted and the Suspense fallback is gone (panel error or CrashFallback, PVC:126-138).
      await expect.poll(() => lost.hits.length, { message: 'an app chunk was aborted' }).toBeGreaterThan(0);
      await expect.soft(p.getByText(T.panelFallback, { exact: true }), 'the fallback settled').toHaveCount(0, { timeout: 15_000 });
      // Source today: no boundary around Suspense (PVC:284-289) → the screen boundary (PVC:350-353) swaps in CrashFallback.
      await expect.soft(p.getByRole('heading', { name: T.screen, exact: true }), 'heading "Mô hình 3D" stays').toBeVisible();
      await expect.soft(canvasBox(p)).toBeVisible();
      await expect.soft(historyRegion(p)).toBeVisible();
      await expect.soft(historyRegion(p).locator('[role="alert"], [role="status"]').first(), 'the error sits inside the panel').toBeVisible();
      await captureEvidence(p, 'E05_23H-B-011_chunk-lost.png', { caption: `app chunks aborted ×${String(lost.hits.length)}` });
      await lost.dispose();
    });
  } finally {
    for (const s of sessions) await closeSession(s);
    await cleanupProjects(api, [pid]);
  }
});
