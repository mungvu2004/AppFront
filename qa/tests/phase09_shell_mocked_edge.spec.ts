/**
 * Phase 9 (QA-09 P2) - shell, [mocked response] FL-9P-X1: dashboard loading before forbidden. The real response is
 * held (page.route + route.continue() after the assertions), nothing is faked. Real stack, pool viewer.
 */
import { expect, test } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import { DESKTOP, adminApi, asMember, mainProject, roleUser, signInRole } from './support/p09/roles';
import { VIEWER_LINE } from './support/p09/P2';

test.use({ viewport: DESKTOP });

test('SCR-05 · FL-9P-X1 · viewer · [mocked response] loading trước forbidden', async ({ context, page }) => {
  const admin = await adminApi();
  const pv = await roleUser(admin, 'viewer', 'shell-mock'); // own slot (parallel files)
  const mp = mainProject();
  const undo = await asMember(admin, mp.projectId, pv);
  try {
    await signInRole(context, pv);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    await page.route(/\/api\/project-summaries/u, async (route) => {
      held = true;
      await gate;
      await route.continue();
    });
    await test.step('[9P-B-002] skeleton trước, dòng vai chưa hiện; sau khi trả về mới có dòng vai', async () => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true })).toBeVisible();
      await expect(page.locator('main .animate-pulse').first()).toBeVisible(); // UPD:402 loading wins
      await expect.poll(() => held, { message: 'project-summaries request is being held' }).toBe(true);
      await expect.soft(page.getByText(VIEWER_LINE, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E09_9P-B-002_viewer_loading.png');
      release();
      await expect(page.getByText(VIEWER_LINE, { exact: true })).toBeVisible();
    });
  } finally {
    await undo();
  }
});
