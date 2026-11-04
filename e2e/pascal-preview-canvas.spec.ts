import { expect, test } from '@playwright/test';

import { fixtureF5 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

/**
 * "Xem trước" dùng chung khung 3D với trình soạn. Khi còn mỗi bên một `<Viewer>`, mỗi lần bật hoặc
 * tắt tạo khung WebGL mới và đưa lại cả cảnh lên GPU, tốn ngang mở lại trang (đo 2026-11-04).
 */

const PROJECT_ID = 'P-FIXTURE0001';
const RENDER_TIMEOUT_MS = 90_000;

test('bật rồi tắt Xem trước vẫn là một khung 3D, không tạo khung mới', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const counter = { contexts: 0 };
    (window as unknown as { __glCounter: typeof counter }).__glCounter = counter;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2' || type === 'webgpu') counter.contexts += 1;
      return original.call(this, type as '2d', ...(rest as [])) as never;
    } as typeof original;
  });
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

  const canvas = page.locator('[data-pascal-viewer-3d] canvas').first();
  await canvas.evaluate((node) => node.setAttribute('data-test-same-canvas', ''));
  const contextCount = () => page.evaluate(() => (window as unknown as { __glCounter: { contexts: number } }).__glCounter.contexts);
  const before = await contextCount();

  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.locator('[data-pascal-viewer-stage]')).toBeVisible();
  await expect(page.locator('canvas[data-test-same-canvas]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-pascal-viewer-stage]')).toBeHidden();
  await expect(page.locator('canvas[data-test-same-canvas]')).toBeVisible();

  expect(await contextCount()).toBe(before);
});
