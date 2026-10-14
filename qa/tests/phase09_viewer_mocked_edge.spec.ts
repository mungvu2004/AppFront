/**
 * Phase 09 · [mocked response] FL-9V-10: DELETE /measurements answered 403 by page.route (<= 0.35 mock share); the rest is the real stack.
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TEST_DATA_PREFIX, captureEvidence } from './support/evidence';
import { seedMeasurement, waitScene, withOwnProject } from './support/p09/P9';

test('SCR-25 · FL-9V-10 · engineer · [mocked response] xoá phép đo 403', async ({ browser }) => {
  test.setTimeout(300_000);
  await withOwnProject(browser, 'engineer', 'viewer-mock', 'p09-v10', async ({ page, admin, projectId }) => {
    const name = `${TEST_DATA_PREFIX}do-403`;
    await seedMeasurement(admin, projectId, name);
    await test.step('[9V-B-020] xoá phép đo bị BE 403 (phản hồi giả)', async () => {
      let served = 0;
      await page.route(/\/api\/projects\/[^/]+\/measurements\/[^/]+$/u, async (route) => {
        if (route.request().method() !== 'DELETE') return route.fallback();
        served += 1;
        return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'FORBIDDEN' }) });
      });
      await page.goto(ROUTES.project.measure(projectId));
      await waitScene(page);
      await page.getByRole('button', { name: `Xoá ${name}`, exact: true }).click(); // MeasurementList.tsx:154
      await expect(page.getByText('Bạn không có quyền xoá phép đo trong dự án này')).toBeVisible(); // useMeasurementTool.ts:217,832-836
      expect(served).toBe(1);
      await captureEvidence(page, 'E09_9V-B-020_mock403.png');
    });
  });
});
