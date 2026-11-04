import { expect, test } from '@playwright/test';

import { fixtureF5 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

/**
 * "Xem trước" dùng chung khung 3D với trình soạn. Khi còn mỗi bên một `<Viewer>`, mỗi lần bật hoặc
 * tắt tạo khung WebGPU mới, đưa lại cả cảnh lên GPU và giữ bộ nhớ khung cũ (đo 2026-11-04: RAM
 * 2,1 → 7,5 GB sau 4 vòng). Canvas đánh dấu còn nguyên sau cả hai chiều là bằng chứng không dựng lại.
 */

const PROJECT_ID = 'P-FIXTURE0001';
const RENDER_TIMEOUT_MS = 90_000;

test('bật rồi tắt Xem trước vẫn là khung 3D ban đầu', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixtureF5().doc as unknown as WireGraphDocument });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1`);
  await page.waitForFunction(
    () => {
      const probe = (window as unknown as { __pascalProbe?: { ready(): boolean; counts(): Record<string, number> } }).__pascalProbe;
      return probe?.ready() === true && (probe.counts()['wall'] ?? 0) > 0;
    },
    null,
    { timeout: RENDER_TIMEOUT_MS },
  );

  await page.locator('[data-pascal-viewer-3d] canvas').first().evaluate((node) => node.setAttribute('data-test-same-canvas', ''));
  const sameCanvas = page.locator('canvas[data-test-same-canvas]');

  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.locator('[data-pascal-viewer-stage]')).toBeVisible();
  await expect(sameCanvas).toBeVisible();

  await page.locator('[data-appfront-header] button:visible').first().click();
  await expect(page.locator('[data-pascal-viewer-stage]')).toBeHidden();
  await expect(sameCanvas).toBeVisible();
});
