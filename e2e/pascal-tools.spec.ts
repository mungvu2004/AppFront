import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixtureF5 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

/**
 * Tách tầng và công cụ đo trên trang 3D Pascal — thay cho `v9/exploded.spec.ts` và
 * `v9/measure.spec.ts` của vỏ Viewer3D cũ (không còn route từ 29eba219).
 *
 * Người dùng tách tầng bằng nút "Cách xếp tầng" và đo bằng nút "Đo" hoặc phím M; đường cũ
 * `/3d/exploded`, `/3d/measure` chuyển tiếp sang `?view=exploded` / `?tool=measure` và trang áp
 * ý định ấy khi cảnh đã có tường (`src/pascal-page/urlIntent.ts`).
 * Bộ F5 có bốn tầng. Vai người xem: trang Pascal chỉ đọc ẩn cả nút đo (khác vỏ cũ, nơi người xem
 * vẫn đo được) — ghi ở báo cáo e2e-triage G3d, chưa có bài.
 */

const PROJECT_ID = 'P-FIXTURE0001';
const RENDER_TIMEOUT_MS = 90_000;

async function openF5(page: Page, search = ''): Promise<void> {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFakeApi(page, { projectId: PROJECT_ID, graphDoc: fixtureF5().doc as unknown as WireGraphDocument });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}&probe=1${search}`);
  await page.waitForFunction(
    () => {
      const probe = (window as unknown as { __pascalProbe?: { ready(): boolean; counts(): Record<string, number> } }).__pascalProbe;
      return probe?.ready() === true && (probe.counts()['wall'] ?? 0) > 0;
    },
    null,
    { timeout: RENDER_TIMEOUT_MS },
  );
}

const measureButton = (page: Page) => page.getByRole('button', { name: /^Đo: /u });

test('tách tầng: nút "Cách xếp tầng" chuyển từ chồng sang tách', async ({ page }) => {
  await openF5(page);
  const layout = page.locator('button[aria-label^="Cách xếp tầng"]');
  await expect(layout).toHaveAttribute('aria-label', /đang chọn: chồng/u);

  await layout.click();
  await page.getByText('Tầng: tách', { exact: true }).click();

  await expect(layout).toHaveAttribute('aria-label', /đang chọn: tách/u);
  await expect(layout).toHaveText('Tầng: tách');
});

test('đo: nút "Đo" bật công cụ đo, Esc tắt, phím M bật lại', async ({ page }) => {
  await openF5(page);
  const measure = measureButton(page);
  await expect(measure).toHaveAttribute('aria-pressed', 'false');

  await measure.click();
  await expect(measure).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await expect(measure).toHaveAttribute('aria-pressed', 'false');

  await page.locator('canvas').first().click({ position: { x: 700, y: 400 } });
  await page.keyboard.press('m');
  await expect(measure).toHaveAttribute('aria-pressed', 'true');
});

test('?view=exploded từ đường chuyển tiếp: trang mở ra ở cách xếp tầng "tách"', async ({ page }) => {
  await openF5(page, '&view=exploded');
  await expect(page.locator('button[aria-label^="Cách xếp tầng"]')).toHaveAttribute('aria-label', /đang chọn: tách/u);
});

test('?tool=measure từ đường chuyển tiếp: trang mở ra với công cụ đo đang bật', async ({ page }) => {
  await openF5(page, '&tool=measure');
  await expect(measureButton(page)).toHaveAttribute('aria-pressed', 'true');
});
