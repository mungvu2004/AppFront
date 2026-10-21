/** Hướng dẫn thao tác trang 3D: tự bật lần đầu, Esc đóng, tải lại không bật, nút xem lại mở lại. */
import { expect, test } from '@playwright/test';

import { fixtureF1 } from '../src/lib/pascal/__fixtures__';

import { installFakeApi, type WireGraphDocument } from './fixtures/fakeApi';

const PROJECT_ID = 'P-FIXTURE0001';

test('tour 3D: bật lần đầu → Esc → tải lại không bật → nút xem lại', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installFakeApi(page, {
    projectId: PROJECT_ID,
    graphDoc: fixtureF1({ ext: false }).doc as unknown as WireGraphDocument,
    tour: true,
  });
  await page.goto(`/editor3d.html?project=${PROJECT_ID}`);

  const dialog = page.getByRole('dialog', { name: /Điều khiển góc nhìn bằng chuột/u });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect(dialog.getByText('1 / 5')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Xem lại hướng dẫn thao tác' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('dialog', { name: /Điều khiển góc nhìn/u })).toBeHidden();

  await page.getByRole('button', { name: 'Xem lại hướng dẫn thao tác' }).click();
  await expect(page.getByRole('dialog', { name: /Điều khiển góc nhìn bằng chuột/u })).toBeVisible();
});
