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
const NO_FLOOR = 'dự án này chưa có tầng nào để đối chiếu.';
const NO_FRAME = 'không tìm được khung bản vẽ nên chưa căn được ảnh quét vào mô hình.';
const NO_SCAN = 'tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.';
const READ_ONLY = 'bạn không có quyền sửa, các điều khiển đang tắt.';

test('vào thẳng một tầng: màn nói chưa căn được và mở lối sang hiệu chỉnh tỷ lệ; đổi sang "trượt" thì có thêm đường chia đôi', async ({
  page,
}) => {
  await page.goto(OVERLAY_PATH);

  await expect(page.getByRole('region', { name: REGION })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByText(NO_FRAME, { exact: true })).toBeVisible();
  await expect(page.getByText(NO_FLOOR, { exact: true })).toHaveCount(0);
  // Lối sang màn tỷ lệ mang mã tầng API của route, không phải mã `Level` của N16.
  await expect(page.getByRole('link', { name: 'sang màn hiệu chỉnh tỷ lệ' })).toHaveAttribute(
    'href',
    ROUTES.project.scale(PROJECT_ID, 'L1'),
  );
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
  await expect(page.getByRole('radio', { name: 'trượt' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'khoá căn' })).toBeDisabled();
});

test(
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
