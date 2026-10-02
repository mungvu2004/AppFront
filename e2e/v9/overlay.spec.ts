import { expect, test } from '@playwright/test';

import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS, OVERLAY_PATH, TWO_SCENES_TEST_TIMEOUT_MS, openViewerSettled } from './v9';

/**
 * Màn đối chiếu bản vẽ (`OverlayComparison`) — `plan.md` V9 mục 3.
 *
 * Ở dev màn LUÔN ở `empty`: nó đọc `store.floors`/`store.spatial` và không ai
 * nạp hai thứ ấy (B-V9-06). Nên ở đây chỉ giữ những ca còn trả lời được "đỏ thì
 * người dùng mất gì" ở `empty`; ba số khớp, vùng lệch, xác nhận (A5) là của
 * tầng đơn vị (65 bài, `plan.md` V9 3.5).
 */

const REGION = 'Màn đối chiếu bản vẽ';
const NO_FLOOR = 'dự án này chưa có tầng nào để đối chiếu.';
const READ_ONLY = 'bạn không có quyền sửa, các điều khiển đang tắt.';

test('rỗng không trắng: màn nói chưa có tầng, đổi sang "trượt" thì có thêm đường chia đôi để kéo', async ({
  page,
}) => {
  await page.goto(OVERLAY_PATH);

  await expect(page.getByRole('region', { name: REGION })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByText(NO_FLOOR, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'xác nhận mô hình khớp bản vẽ' })).toBeDisabled();

  const sliders = page.getByRole('slider');
  const before = await sliders.count();
  const swipe = page.getByRole('radio', { name: 'trượt' });

  await swipe.click();

  await expect(swipe).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'chồng lớp' })).toHaveAttribute('aria-checked', 'false');
  // "Tăng lên", không cứng một con số: số thanh trượt phụ thuộc bộ mẫu (plan.md V9 3.6 O-2).
  await expect.poll(() => sliders.count()).toBeGreaterThan(before);
});

test('bàn phím: mũi tên phải trên nhóm "kiểu đối chiếu" chuyển sang kiểu kế tiếp (A12)', async ({ page }) => {
  await page.goto(OVERLAY_PATH);

  const overlayMode = page.getByRole('radio', { name: 'chồng lớp' });
  await expect(overlayMode).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await overlayMode.focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByRole('radio', { name: 'trượt' })).toHaveAttribute('aria-checked', 'true');
});

test('vai Người xem: các điều khiển tắt, và màn nói vì sao', async ({ page }) => {
  await signInAs(page, 'viewer', OVERLAY_PATH);

  await expect(page.getByText(READ_ONLY, { exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByText(NO_FLOOR, { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'trượt' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'khoá căn' })).toBeDisabled();
});

test.fixme(
  'mở từ /3d (nhà mẫu bốn tầng), màn đối chiếu thấy các tầng ấy chứ không nói "chưa có tầng nào" (B-V9-06)',
  // Lý do: màn đọc `store.floors` và `store.spatial` (`useOverlayComparison.ts:358-361`)
  // mà không nơi nào nạp chúng — cùng gốc Q1 (đường nạp thật chưa có); `/3d` thì dựng
  // nhà mẫu ở chế độ mock. Từ khi có lối vào (B-V9-01), người dùng đi một bước từ màn
  // có bốn tầng sang màn nói không có tầng nào. Mở lại khi có đường nạp tầng thật,
  // hoặc màn dùng cùng luật nhà mẫu với `/3d`.
  async ({ page }) => {
    test.setTimeout(TWO_SCENES_TEST_TIMEOUT_MS);
    await openViewerSettled(page);
    await page
      .getByRole('navigation', { name: 'Màn 3D khác' }).getByRole('button', { name: 'Đối chiếu bản vẽ', exact: true }).click();

    await expect(page.getByRole('region', { name: REGION })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect(page.getByText(NO_FLOOR, { exact: true })).toHaveCount(0);
  },
);
