import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import {
  FIRST_PAINT_TIMEOUT_MS,
  OVERLAY_PATH,
  PROJECT_ID,
  TWO_SCENES_TEST_TIMEOUT_MS,
  openViewerSettled,
} from './v9';

/**
 * Màn đối chiếu bản vẽ (`OverlayComparison`) — `plan.md` V9 mục 3.
 *
 * Kho rỗng thì màn đọc tầng của route qua N16 (B-V9-06), nên ở dev nó có tầng.
 * `L1` của bộ mẫu không tìm thấy khung bản vẽ ⇒ `error` có chủ đích. "Chưa có tầng
 * nào" chỉ còn khi N16 hỏng — bộ mẫu không làm nó hỏng, nên ca ấy ở tầng đơn vị.
 * Ba số khớp, vùng lệch, xác nhận (A5) là của tầng đơn vị (`plan.md` V9 3.5).
 */

const REGION = 'Màn đối chiếu bản vẽ';
const NO_FLOOR = 'Dự án này chưa có tầng nào để đối chiếu.';
const NO_FRAME = 'Không tìm được khung bản vẽ nên chưa căn được ảnh quét vào mô hình.';
const NO_SCAN = 'Tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.';
// Câu chỉ-đọc cũ của thanh công cụ đã bỏ (OverlayComparisonToolbar.test.tsx:156 khẳng định nó vắng);
// vai chỉ xem gặp lỗi nội dung (thiếu khung) thì màn ở `forbidden` và nói câu này (Q4b, 9U-D-063).
const READ_ONLY = 'Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.';

test('vào thẳng một tầng: màn nói chưa căn được và mở lối sang hiệu chỉnh tỷ lệ; đổi sang "trượt" thì có thêm đường chia đôi', async ({
  page,
}) => {
  await page.goto(OVERLAY_PATH);

  await expect(page.getByRole('region', { name: REGION })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByText(NO_FRAME, { exact: true })).toBeVisible();
  await expect(page.getByText(NO_FLOOR, { exact: true })).toHaveCount(0);
  // Lối sang màn tỷ lệ mang mã tầng API của route, không phải mã `Level` của N16.
  await expect(page.getByRole('link', { name: 'Sang màn hiệu chỉnh tỷ lệ' })).toHaveAttribute(
    'href',
    ROUTES.project.scale(PROJECT_ID, 'L1'),
  );
  // S-28: tầng chưa có mô hình thì cổng (FlowGate) không có nút xác nhận — không còn nút tắt đứng chờ.
  await expect(page.getByRole('button', { name: 'Xác nhận khớp bản vẽ' })).toHaveCount(0);

  const divider = page.getByRole('slider', { name: /^Đường chia đôi/u });
  await expect(divider).toHaveCount(0);
  const swipe = page.getByRole('radio', { name: 'trượt' });

  await swipe.click();

  await expect(swipe).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: 'chồng lớp' })).toHaveAttribute('aria-checked', 'false');
  // Bám đúng đường chia đôi theo tên, không đếm thanh trượt: ở "trượt" thanh độ mờ ảnh nguồn ẩn đi
  // (G4b-26), nên tổng số thanh trượt không tăng dù đường chia đôi đã có.
  await expect(divider).toBeVisible();
});

test('bàn phím: mũi tên phải trên nhóm "Kiểu đối chiếu" chuyển sang kiểu kế tiếp (A12)', async ({ page }) => {
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
  // Đổi kiểu đối chiếu chỉ là cách XEM nên vai xem vẫn dùng được (cả trên master). Điều khiển sửa
  // là ô dung sai: tắt. "Khoá căn" ẩn hẳn vì cổng chưa đặt được ảnh vào mô hình (BUG-599).
  await expect(page.getByRole('radio', { name: 'trượt' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Dung sai' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Khoá căn' })).toHaveCount(0);
});

// `/3d` giờ là trang Pascal (`Pascal3dPage`, router.tsx), không còn Viewer3D với câu "Mô hình 3D đã dựng
// xong." hay nav "Màn 3D khác" — lối vào này không còn tồn tại. Điều B-V9-06 chứng minh (kho chưa có
// tầng của route thì màn tự đọc N16, không nói "chưa có tầng nào") đã có ở bài "vào thẳng một tầng" phía
// trên và ở `useOverlayComparison.test.ts` ("[X4-A-036 / BUG-326]", "overlay race").
test.skip(
  'mở từ /3d bằng nav "Màn 3D khác", màn đối chiếu đọc được tầng chứ không nói "chưa có tầng nào" (B-V9-06)',
  async ({ page }) => {
    test.setTimeout(TWO_SCENES_TEST_TIMEOUT_MS);
    await openViewerSettled(page);
    await page
      .getByRole('navigation', { name: 'Màn 3D khác' })
      .getByRole('button', { name: 'Đối chiếu bản vẽ', exact: true })
      .click();

    await expect(page.getByRole('region', { name: REGION })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    // Tầng nhà mẫu của `/3d` không có ảnh quét trong bộ mẫu API — câu đúng là câu này.
    await expect(page.getByText(NO_SCAN, { exact: true })).toBeVisible();
    await expect(page.getByText(NO_FLOOR, { exact: true })).toHaveCount(0);
  },
);
