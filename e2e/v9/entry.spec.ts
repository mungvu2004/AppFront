import { expect, test } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';

import {
  EXPLODED_PATH,
  FIRST_PAINT_TIMEOUT_MS,
  MEASURE_PATH,
  PROJECT_ID,
  TWO_SCENES_TEST_TIMEOUT_MS,
  openViewerSettled,
} from './v9';

/**
 * Lối vào ba màn 3D từ sản phẩm — B-V9-01 (Q10g = A′).
 *
 * Trước bản sửa ba route chỉ tới được bằng gõ địa chỉ: `ROUTES.project.exploded /
 * measure / overlay` không có nơi gọi nào trong `src/`. Nay cột panel của `/3d`
 * có nhóm "Màn 3D khác". Mỗi ca bấm một nút rồi khẳng định đích đúng VÀ màn đích
 * dựng được — một nút điều hướng tới màn trắng không phải lối vào.
 */

const SIBLINGS = 'Màn 3D khác';

/**
 * Đường đích. Đối chiếu nhận mã tầng đầu của nhà mẫu `/3d` — đọc đúng một đoạn
 * bất kỳ, không viết tay mã tầng. Đường chỉ có chữ, số, `-` và `/`, nên không
 * có ký tự nào cần thoát trong biểu thức.
 */
const OVERLAY_ANY_FLOOR = new RegExp(`^${ROUTES.project.overlay(PROJECT_ID, '[^/]+')}$`, 'u');

const CASES = [
  { label: 'Tách tầng', path: new RegExp(`^${EXPLODED_PATH}$`, 'u'), landmark: 'Nội dung tách tầng' },
  { label: 'Công cụ đo', path: new RegExp(`^${MEASURE_PATH}$`, 'u'), landmark: 'Lớp phủ công cụ đo' },
  { label: 'Đối chiếu bản vẽ', path: OVERLAY_ANY_FLOOR, landmark: 'Màn đối chiếu bản vẽ' },
] as const;

for (const { label, path, landmark } of CASES) {
  test(`từ /3d, nút "${label}" mở đúng màn ấy (B-V9-01)`, async ({ page }) => {
    test.setTimeout(TWO_SCENES_TEST_TIMEOUT_MS);
    await openViewerSettled(page);

    const siblings = page.getByRole('navigation', { name: SIBLINGS });
    await siblings.getByRole('button', { name: label, exact: true }).click();

    await expect(page.getByRole('region', { name: landmark })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    expect(pathOf(page.url())).toMatch(path);
  });
}
