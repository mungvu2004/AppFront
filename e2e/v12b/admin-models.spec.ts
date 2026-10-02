import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

/**
 * Nhóm V12b — `adminModels` (`/admin/models`), `plan.md` mục 8 · V12 · 9.
 *
 * Màn chỉ đọc (chín năng lực ghi `false`, `modelLibraryGateway.ts`), kể cả với `admin`.
 * Đơn vị (`ModelLibrary.test.tsx`, 13 bài) phủ sắp xếp cột và `Esc` gọi `closeDetail`
 * qua hàm giả; nó không phủ lọc, chế độ lưới, và `Esc` qua sổ phím thật — ba thứ ở đây.
 */

const MODEL_COUNT = 16;
const READ_ONLY_REASON =
  'vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện';

/** Một ô tổng kết: chữ chú thích và con số của nó (`ModelLibrarySummary.tsx`). */
function figure(page: Page, caption: string) {
  return page.getByText(caption, { exact: true }).locator('xpath=..');
}

const search = (page: Page) => page.getByRole('textbox', { name: 'tìm model' });

test.describe('engineer (vai mặc định, goto thẳng)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(ROUTES.adminModels);
    await expect(figure(page, 'tổng số model')).toHaveText(new RegExp(`tổng số model\\s*${MODEL_COUNT}$`, 'u'));
  });

  test('B-V12b-04 đường dẫn trang viết thường như mọi màn quản trị khác (A6)', async ({ page }) => {
    // `exact`: Playwright so tên không phân biệt hoa/thường khi không có nó, nên
    // `Đường dẫn trang` cũ lọt qua mà không ai thấy (F14).
    const breadcrumb = page.getByRole('navigation', { name: 'đường dẫn trang', exact: true });
    await expect(breadcrumb).toHaveText(/^quản trị\s*›\s*thư viện model$/u);
  });

  test('MD-1 lọc không ra gì thì nói ra bằng lời, xoá ô thì về đủ 16 (A11 empty)', async ({ page }) => {
    await search(page).fill('zzzz');

    await expect(page.getByText('Không tìm thấy model phù hợp.')).toBeVisible();
    await expect(figure(page, 'tổng số model')).toHaveText(/tổng số model\s*0$/u);
    await expect(figure(page, 'tổng dung lượng')).toHaveText(/tổng dung lượng\s*0 B$/u);
    await expect(figure(page, 'model nặng')).toHaveText(/model nặng\s*0$/u);

    await search(page).fill('');
    await expect(figure(page, 'tổng số model')).toHaveText(new RegExp(`tổng số model\\s*${MODEL_COUNT}$`, 'u'));
  });

  test('MD-2 Esc đóng đúng tấm chi tiết model, ở lại /admin/models (A12)', async ({ page }) => {
    await page.getByRole('button', { name: 'bàn ăn sáu chỗ' }).click();
    const detail = page.getByRole('complementary', { name: 'chi tiết model' });
    await expect(detail).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(detail).toBeHidden();
    expect(new URL(page.url()).pathname).toBe(ROUTES.adminModels);
  });

  test('MD-3 chế độ lưới có 16 thẻ, lọc "ghế" còn 2; kích thước dùng dấu phẩy (A15)', async ({ page }) => {
    // A15 trên bảng trước khi đổi chế độ: `1,80 m × 0,90 m × 0,75 m`; `8.400` tam giác là
    // nhóm nghìn nên mẫu phủ định đòi đơn vị `m` ngay sau.
    const table = page.getByRole('table');
    await expect(table).toContainText(/\d,\d{2} m/u);
    await expect(table).not.toContainText(/\d\.\d{1,2} m/u);

    await page.getByRole('radio', { name: 'Lưới' }).click();
    const grid = page.getByRole('list', { name: 'lưới model' });
    await expect(grid.getByRole('listitem')).toHaveCount(MODEL_COUNT);

    await search(page).fill('ghế');
    await expect(grid.getByRole('listitem')).toHaveCount(2);
  });
});

const ROLE_ROWS = [
  { role: 'engineer', readOnly: true },
  { role: 'viewer', readOnly: true },
  { role: 'admin', readOnly: false },
] as const;

for (const row of ROLE_ROWS) {
  test(`MD-F vai ${row.role}: ${row.readOnly ? 'có' : 'không'} dòng giải thích chỉ-xem (A11 forbidden dạng banner)`, async ({
    page,
  }) => {
    await signInAs(page, row.role, ROUTES.adminModels);
    await expect(search(page)).toBeVisible();
    // Banner chứ không chặn: bảng vẫn hiện ở mọi vai.
    await expect(page.getByRole('button', { name: 'bàn ăn sáu chỗ' })).toBeVisible();
    await expect(page.getByText(READ_ONLY_REASON)).toHaveCount(row.readOnly ? 1 : 0);
  });
}
