import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAs } from '../fixtures/session';

import {
  EXPLODED_PATH,
  FIRST_PAINT_TIMEOUT_MS,
  FIXTURE_STATUS,
  MEASURE_PATH,
  expectSceneDrawn,
  openWithFixture,
} from './v9';

/**
 * Màn tách tầng (`ExplodedView`) — `plan.md` V9 mục 1.
 *
 * Bảy trạng thái, a11y, lệch trục 180 mm, thẻ tầng: tầng đơn vị (20 bài). Ở đây
 * chỉ những gì cần trình duyệt thật: canvas WebGL thật, phím thật qua sổ phím.
 */

const SEPARATION = /^đã tách \d+%$/u;

const separation = (page: Page) => page.getByText(SEPARATION);

/** Phím của màn ở phạm vi `canvas`: đưa tiêu điểm vào vùng nội dung trước. */
async function focusScene(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Nội dung tách tầng' }).click();
}

test('ca mồi Q1 (không bơm): màn dựng đúng nhà mẫu của /3d — canvas đã vẽ, 4 tầng (B-V9-02)', async ({
  page,
}) => {
  // Đỏ ngày sản phẩm có đường nạp thật: khi ấy kho không rỗng và nhà mẫu biến mất.
  await openWithFixture(page, EXPLODED_PATH);

  await expectSceneDrawn(page);
  await expect(separation(page)).toHaveText('đã tách 0%');
  await expect(page.getByText('Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.')).toHaveCount(0);
});

test('độ tách đổi thật: ba mức sẵn, rồi phím E qua sổ phím', async ({ page }) => {
  await openWithFixture(page, EXPLODED_PATH);
  const presets = page.getByRole('radiogroup', { name: 'Mức tách sẵn' });

  await presets.getByRole('radio', { name: 'tách hết' }).click();
  await expect(separation(page)).toHaveText('đã tách 100%');

  await presets.getByRole('radio', { name: 'gộp' }).click();
  await expect(separation(page)).toHaveText('đã tách 0%');

  await focusScene(page);
  await page.keyboard.press('e');
  await expect(separation(page)).toHaveText('đã tách 100%');
});

test('Space tách hết rồi hợp lại về mức cũ (một chu kỳ, A12)', async ({ page }) => {
  await openWithFixture(page, EXPLODED_PATH);
  await expect(separation(page)).toHaveText('đã tách 0%');

  await focusScene(page);
  await page.keyboard.press('Space');

  // Nửa chu kỳ là `AMBIENT_LOOP_MS` (700 ms) — đủ dài để thấy trạng thái giữa.
  await expect(separation(page)).toHaveText('đã tách 100%');
  await expect(separation(page)).toHaveText('đã tách 0%');
});

test('vai Người xem: màn nói vì sao không sửa được vị trí tầng', async ({ page }) => {
  await signInAs(page, 'viewer', EXPLODED_PATH);

  await expect(page.getByText(FIXTURE_STATUS, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  // Câu `sr-only` — có trong cây truy cập, không chiếm chỗ trên màn.
  await expect(page.getByText(/^Bạn đang xem ở vai người xem nên không sửa được vị trí tầng\.$/iu)).toHaveCount(1);
});

test.fixme(
  'vai Người xem: hai câu "không có quyền" cạnh nhau viết tên vai giống nhau (B-V9-05, chờ quyết)',
  // Lý do: `ExplodedView.tsx:130` viết "vai người xem", `ViewerInspector.tsx:86` viết
  // "vai Người xem"; cả sản phẩm cũng trộn hai cách. Mở lại khi người duyệt chốt một
  // cách viết tên vai (A6) và chuỗi đã sửa theo.
  async ({ page }) => {
    await signInAs(page, 'viewer', EXPLODED_PATH);
    const roleNames = page.getByText(/vai [Nn]gười xem/u);
    await expect(roleNames).toHaveCount(2, { timeout: FIRST_PAINT_TIMEOUT_MS });

    const spellings = (await roleNames.allTextContents()).map((text) => /vai [Nn]gười xem/u.exec(text)?.[0]);
    expect(new Set(spellings).size).toBe(1);
  },
);

for (const [screen, path] of [
  ['tách tầng', EXPLODED_PATH],
  ['đo', MEASURE_PATH],
] as const) {
  test(`ray tầng của màn ${screen} gọi tầng bằng tên, không lộ mã bộ mẫu kiểu "L-01FIXTURE0" (B-V9-08)`, async ({
    page,
  }) => {
    await openWithFixture(page, path);
    // Chữ NHÌN THẤY, không tên truy cập: nút đã mang aria-label "Tầng trệt, cao độ …",
    // chỉ chữ in trên nút từng là mã — nên lỗi chỉ người nhìn màn thấy.
    await expect(page.getByText(/FIXTURE/u)).toHaveCount(0);
    await expect(page.getByRole('option', { name: /cao độ/u })).toHaveText(['Trệt', '02', '03', 'Mái']);
  });
}
