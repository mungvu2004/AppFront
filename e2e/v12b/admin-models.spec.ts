import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { signInAs } from '../fixtures/session';

import { FIRST_PAINT_TIMEOUT_MS } from './firstPaint';

/**
 * Nhóm V12b — `adminModels` (`/admin/models`), `plan.md` mục 8 · V12 · 9.
 *
 * Màn chỉ đọc (chín năng lực ghi `false`, `modelLibraryGateway.ts`), kể cả với `admin`.
 * Đơn vị (`ModelLibrary.test.tsx`, 13 bài) phủ sắp xếp cột và `Esc` gọi `closeDetail`
 * qua hàm giả; nó không phủ lọc, chế độ lưới, và `Esc` qua sổ phím thật — ba thứ ở đây.
 *
 * G2-25: `AdminGate` chặn cả khu `/admin/*` cho vai không phải `admin`, nên vai mặc định
 * (`engineer`) không còn vào được màn; nhóm chính đăng nhập `admin`.
 */

const MODEL_COUNT = 16;
const READ_ONLY_REASON =
  'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện';
const ADMIN_GATE_TITLE = 'Khu Quản trị chỉ dành cho quản trị viên';

/** Một số trên dòng trạng thái của PageHead (`ModelLibrary.tsx`, data-testid). */
function figure(page: Page, testId: string) {
  return page.getByTestId(testId);
}

const search = (page: Page) => page.getByRole('textbox', { name: 'Tìm mẫu 3D' });

test.describe('admin (đăng nhập, G2-25)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'admin', ROUTES.adminModels);
    await expect(figure(page, 'model-library-total-count')).toHaveText(String(MODEL_COUNT), { timeout: FIRST_PAINT_TIMEOUT_MS });
  });

  test('B-V12b-04 đường dẫn trang viết thường như mọi màn quản trị khác (A6)', async ({ page }) => {
    // `exact`: Playwright so tên không phân biệt hoa/thường khi không có nó, nên
    // `Đường dẫn trang` cũ lọt qua mà không ai thấy (F14).
    const breadcrumb = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
    await expect(breadcrumb).toHaveCount(0); // breadcrumb removed; the h1 names the screen
  });

  test('MD-1 lọc không ra gì thì nói ra bằng lời, xoá ô thì về đủ 16 (A11 empty)', async ({ page }) => {
    await search(page).fill('zzzz');

    // G2-18: ô rỗng thành EmptyState có tiêu đề và câu giải thích.
    await expect(page.getByRole('heading', { name: 'Không tìm thấy mẫu 3D', exact: true })).toBeVisible();
    await expect(page.getByText('Không có mẫu 3D nào khớp với từ khoá hoặc danh mục đang chọn.')).toBeVisible();
    await expect(figure(page, 'model-library-total-count')).toHaveText('0');
    await expect(figure(page, 'model-library-total-size')).toHaveText('0 B');
    await expect(figure(page, 'model-library-heavy-count')).toHaveText('0');

    await search(page).fill('');
    await expect(figure(page, 'model-library-total-count')).toHaveText(String(MODEL_COUNT));
  });

  test('MD-2 Esc đóng đúng tấm chi tiết model, ở lại /admin/models (A12)', async ({ page }) => {
    await page.getByRole('button', { name: 'bàn ăn sáu chỗ' }).click();
    const detail = page.getByRole('complementary', { name: 'Chi tiết model' });
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
    const grid = page.getByRole('list', { name: 'lưới mẫu 3D' });
    await expect(grid.getByRole('listitem')).toHaveCount(MODEL_COUNT);

    await search(page).fill('ghế');
    await expect(grid.getByRole('listitem')).toHaveCount(2);
  });
});

const ROLE_ROWS = [
  { role: 'engineer', isAdmin: false },
  { role: 'viewer', isAdmin: false },
  { role: 'admin', isAdmin: true },
] as const;

for (const row of ROLE_ROWS) {
  test(`MD-F vai ${row.role}: ${row.isAdmin ? 'thấy bảng, không dòng chỉ-xem' : 'bị cổng quản trị chặn, không thấy bảng'} (A11 forbidden, G2-25)`, async ({
    page,
  }) => {
    await signInAs(page, row.role, ROUTES.adminModels);
    if (!row.isAdmin) {
      // G2-25: cổng thay cả trang — không thanh tab quản trị, không bảng, không ô tìm.
      await expect(page.getByRole('heading', { level: 1, name: ADMIN_GATE_TITLE })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      await expect(page.getByRole('button', { name: 'Về bảng điều khiển' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Mục quản trị' })).toHaveCount(0);
      await expect(search(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'bàn ăn sáu chỗ' })).toHaveCount(0);
      return;
    }
    await expect(search(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    await expect(page.getByRole('button', { name: 'bàn ăn sáu chỗ' })).toBeVisible();
    await expect(page.getByText(READ_ONLY_REASON)).toHaveCount(0);
  });
}
