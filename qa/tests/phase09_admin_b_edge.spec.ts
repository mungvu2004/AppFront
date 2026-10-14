/**
 * Phase 09 · FL-9A-05: an admin demoted mid-session sees the forbidden lock on the next refetch. Pool user `p09-admin-flip`;
 * role changed through the real admin API (PATCH /api/users/{id}/role) and restored in `finally`.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { setRole } from './support/p09/P9';
import { adminApi, roleUser, signInRole } from './support/p09/roles';

test('SCR-35 · FL-9A-05 · admin · demoted mid-session · forbidden lock', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await adminApi();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const flip = await roleUser(admin, 'admin', 'admin-flip'); // slot `p09-admin-flip-admin`
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
      await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
      await expect(forbidden(page)).toHaveCount(0);
      await setRole(admin, flip, 'viewer');
      const before = page.url();
      // refetch without reload: focus / visibility, then "Thử lại" if offered (useTrainingJobs.ts:569-580)
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const retry = page.getByRole('button', { name: 'Thử lại' });
      if (await retry.isVisible()) await retry.click();
      try {
        await expect(forbidden(page)).toBeVisible({ timeout: 15_000 });
      } catch (error) {
        await attachJson('E09_9A-D-017_network.json', { net });
        throw error;
      }
      expect(page.url()).toBe(before);
      const locked = net.length;
      await expect(forbidden(page)).toBeVisible();
      expect(net.length, `new /api/admin/ml/* after lock: ${net.slice(locked).join(', ')}`).toBe(locked);
      await captureEvidence(page, 'E09_9A-D-017_demoted_lock');
    });
  } finally {
    await setRole(admin, flip, 'admin');
    await context.close();
    await admin.dispose();
  }
});
