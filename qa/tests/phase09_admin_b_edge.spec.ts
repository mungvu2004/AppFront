/**
 * Phase 09 · FL-9A-05: an admin demoted mid-session sees the forbidden lock on the next refetch. Pool user `p09-admin-flip`;
 * role changed through the real admin API (PATCH /api/users/{id}/role) and restored in `finally`.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { setRole } from './support/p09/P9';
import { attachAdminSnap } from './support/p09/adminSnap';
import { adminApi, roleUser, signInRole } from './support/p09/roles';

test('SCR-35 · FL-9A-05 · admin · demoted mid-session · forbidden lock', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await adminApi();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const flip = await roleUser(admin, 'admin', 'admin-b'); // slot `p09-admin-b-admin`
  await setRole(admin, flip, 'admin'); // start as admin even if a killed run left it demoted
  const net: string[] = [];
  const forbidden = (page: import('@playwright/test').Page) =>
    page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true });
  try {
    await signInRole(context, flip);
    const page = await context.newPage();
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (pathname.startsWith('/api/admin/ml/')) net.push(`${r.method()} ${pathname}`);
    });
    await test.step('[9A-D-017] admin hạ vai giữa phiên → màn khoá, không điều hướng', async () => {
      await page.goto(ROUTES.adminTrainingJobs);
      await expect(page.getByRole('button', { name: 'Tạo lượt huấn luyện' })).toBeVisible({ timeout: 30_000 }); // TrainingJobs.tsx:36 real admin content
      await expect(forbidden(page)).toHaveCount(0);
      await attachAdminSnap(page, 'E09_9A-D-017_before-demote.json', net);
      await setRole(admin, flip, 'viewer');
      const before = page.url();
      // jobs list is fresh for 30 s (cachePolicy.ts staleTime) so focus sends no request (R1: net had 1 GET only);
      // the datasets tab fires a fresh BE read (useTrainingJobs.ts tabDatasetsQuery) -> 403 locks the page (:569-580)
      await page.getByRole('tab', { name: 'Bộ dữ liệu' }).click(); // TrainingJobs.tsx:33 tabDatasets
      const retry = page.getByRole('button', { name: 'Thử lại' });
      const retryShown = await retry.isVisible();
      if (retryShown) await retry.click();
      await attachAdminSnap(page, 'E09_9A-D-017_after-focus.json', [`retryShown=${retryShown}`, ...net]);
      try {
        await expect(forbidden(page)).toBeVisible({ timeout: 15_000 });
      } catch (error) {
        await attachJson('E09_9A-D-017_network.json', { net });
        throw error;
      }
      expect(page.url()).toBe(before);
      const locked = net.length;
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForLoadState('networkidle');
      await expect(forbidden(page)).toBeVisible();
      expect(net.length, `new /api/admin/ml/* after lock: ${net.slice(locked).join(', ')}`).toBe(locked);
      await captureEvidence(page, 'E09_9A-D-017_demoted_lock.png');
    });
  } finally {
    await setRole(admin, flip, 'admin');
    await context.close();
    await admin.dispose();
  }
});
