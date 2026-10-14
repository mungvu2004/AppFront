/**
 * Phase 5 — SCR-23 "Diện tích phòng", EDGE layer, MOCKED RESPONSES (QA-05c P3, plan `flows-C2.md`
 * "phase05_panels_a_mocked_edge.spec.ts": 1 flow, 2 steps). The rename path of the vendor panel (RAP:132-152) reaches the
 * server only through the editor autosave → `useFloorLayerAutosave` → `PUT /api/projects/:p/floors/:f/spatial/layer` (PVC:208-241).
 * Two failures the real stack cannot produce on demand are faked on that PUT only:
 *   - network loss (`route.abort`) — unpairable: network loss;
 *   - 500 (`route.fulfill`) — unpairable: the BE never answers 500 by choice.
 * Pairing: the real PUT of the same rename path is FL-23R-06 step 4 `[23R-G-001]` (`phase05_panels_a_edge.spec.ts`); the last
 * rename of this flow (route removed) is a real 200 as well. Everything else is real: project, layers, session, N15/N16.
 * Copy and selectors: `support/p05/P3.ts`. ⚑ none.
 *
 * ## Request budget
 * - `POST /api/auth/login`: 0 (stored admin session; 1 UI sign-in only if it is dead). `POST /api/auth/refresh`: 2 + 1 per load.
 * - `POST /api/projects` 1 + `DELETE` 1; seed #35 PUTs 3 (no rate limit). Screen PUTs: aborted / faked ones never reach the BE;
 *   1–2 real ones at the end.
 */
import { expect, test, type Route } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import {
  PV,
  SAVED_AT,
  closeAdminSession,
  expand,
  nextLayerPut,
  openAdminSession,
  openPascal,
  openRailPanel,
  RA,
  renameRoom,
  roomButton,
  saveLine,
  seedRA1,
  toast,
  type AdminSession,
} from './support/p05/P3';

/** Matches #35 by path only (no query on that route). */
const LAYER_URL = (url: URL): boolean => url.pathname.endsWith('/spatial/layer');
/** A failed save can go through the saver's retry before the indicator turns 'failed' (useAutosave). */
const FAILED_TOAST_TIMEOUT_MS = 30_000;

test.describe('E05 SCR-23 Diện tích phòng — mocked-response flow (QA-05c P3)', () => {
  test('SCR-23 · FL-23R-M1 · [mocked response] đổi tên khi PUT đứt mạng / 500 — cặp thật FL-23R-06 bước 4 (23R-G-001)', async ({ browser }) => {
    // Paired with the real PUT 200 of `[23R-G-001]` in phase05_panels_a_edge.spec.ts (same rename → autosave → #35 path).
    test.setTimeout(120_000);
    let s: AdminSession | undefined;
    try {
      s = await openAdminSession(browser);
      const { page } = s;
      const seeded = await seedRA1(s, 'p3-rm1');
      await openPascal(page, seeded.projectId);
      const panel = await openRailPanel(page, RA.title);
      await expand(panel);
      const failedToast = toast(page, PV.saveFailed);

      await test.step('[23R-G-007] PUT aborted (network loss), "Bếp" → "Bếp M": toast "Chưa lưu được thay đổi" (PVC:222-230)', async () => {
        await page.route(LAYER_URL, (route: Route) => (route.request().method() === 'PUT' ? route.abort() : route.continue()));
        await renameRoom(panel, 'Bếp', 'Bếp M');
        await expect(roomButton(panel, 'Bếp M')).toBeVisible();
        await expect(failedToast.first()).toBeVisible({ timeout: FAILED_TOAST_TIMEOUT_MS });
        await captureEvidence(page, 'E05_23R-G-007_network-loss.png', { caption: 'PUT …/spatial/layer aborted by route (mocked)' });
      });

      await test.step('[23R-G-008] PUT 500, "Ăn" → "Ăn M": toast again; route removed, "Kho" → "Kho M": real PUT 200, "Đã lưu lúc"', async () => {
        // The G-007 toast lives ~8 s (Toast.tsx:99-110) and PVC:222-230 publishes only on a change to 'failed': wait it out,
        // so the toast asserted below is a new one.
        await expect(failedToast).toHaveCount(0, { timeout: FAILED_TOAST_TIMEOUT_MS });
        await page.unroute(LAYER_URL);
        await page.route(LAYER_URL, (route: Route) =>
          route.request().method() === 'PUT'
            ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'mocked', requestId: 'qa-p3-mock' }) })
            : route.continue(),
        );
        const faked = page.waitForResponse((res) => res.request().method() === 'PUT' && LAYER_URL(new URL(res.url())) && res.status() === 500, {
          timeout: FAILED_TOAST_TIMEOUT_MS,
        });
        await renameRoom(panel, 'Ăn', 'Ăn M');
        await faked;
        await expect.soft(failedToast.first()).toBeVisible({ timeout: FAILED_TOAST_TIMEOUT_MS });
        await expect.soft(saveLine(page)).not.toHaveText(SAVED_AT);
        await page.unroute(LAYER_URL);
        const real = nextLayerPut(page, undefined, FAILED_TOAST_TIMEOUT_MS);
        await renameRoom(panel, 'Kho', 'Kho M');
        expect.soft((await real).status(), 'real PUT after the route is gone').toBe(200);
        await expect.soft(saveLine(page)).toHaveText(SAVED_AT, { timeout: FAILED_TOAST_TIMEOUT_MS });
        await captureEvidence(page, 'E05_23R-G-008_500-then-200.png', { caption: 'PUT → 500 (mocked) then toast; route removed → real PUT 200' });
      });
    } finally {
      await s?.page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
      await closeAdminSession(s);
    }
  });
});
