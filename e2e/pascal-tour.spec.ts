/**
 * Hướng dẫn thao tác trang 3D (UX-R1 K47): lần đầu chỉ hiện gợi ý nhỏ không phủ tối, tour KHÔNG tự bật;
 * "Xem hướng dẫn" mở tour → Esc → tải lại không còn gợi ý → nút '?' mở lại tour.
 */
import { expect, test } from '@playwright/test';

import { fixtureF1 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

const PROJECT_ID = 'P-FIXTURE0001';

test('tour 3D: gợi ý lần đầu → Xem hướng dẫn → Esc → tải lại không còn gợi ý → nút xem lại', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installFakeApi(page, {
    projectId: PROJECT_ID,
    graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument,
    tour: true,
  });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}`);

  const hint = page.getByRole('complementary', { name: 'Gợi ý thao tác 3D' });
  const dialog = page.getByRole('dialog', { name: /Điều khiển góc nhìn bằng chuột/u });
  await expect(hint).toBeVisible({ timeout: 60_000 });
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-pascal-tour]')).toHaveCount(0); // không phủ tối

  await hint.getByRole('button', { name: 'Xem hướng dẫn' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1 / 5')).toBeVisible();
  await expect(hint).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Xem lại hướng dẫn thao tác' })).toBeVisible({ timeout: 60_000 });
  await expect(hint).toBeHidden();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Xem lại hướng dẫn thao tác' }).click();
  await expect(dialog).toBeVisible();
});

test('tour 3D: đóng gợi ý lần đầu thì nhớ, tải lại không hiện lại', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installFakeApi(page, {
    projectId: PROJECT_ID,
    graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument,
    tour: true,
  });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}`);

  const hint = page.getByRole('complementary', { name: 'Gợi ý thao tác 3D' });
  await expect(hint).toBeVisible({ timeout: 60_000 });
  await hint.getByRole('button', { name: 'Đóng gợi ý' }).click();
  await expect(hint).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Xem lại hướng dẫn thao tác' })).toBeVisible({ timeout: 60_000 });
  await expect(hint).toBeHidden();
});
