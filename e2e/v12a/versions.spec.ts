import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

/**
 * V12a — `projectVersions` (`docs/notes/e2e/plan.md` V12 mục 6).
 *
 * Trước B-V12-10 màn này không mở được bằng bất kỳ đường nào: route đọc tầng từ kho (không
 * ai đặt) và không có nguồn liệt kê phiên bản. Nay nguồn là N17 (bộ mẫu dev phục vụ nó),
 * và route tự chọn tầng: `?floorId=` → tầng đang mở → tầng đầu tiên của dự án.
 *
 * Không bơm kho — đây là đường sản phẩm thật. Chỉ đọc danh sách: so sánh/phục hồi cần nội
 * dung bản chụp (N18), chưa nối.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

test('mở "Lịch sử phiên bản" từ đường dẫn của dự án thì thấy danh sách phiên bản của tầng đầu tiên (B-V12-10)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.versions('project-1'));

  const list = page.getByRole('navigation', { name: 'Danh sách phiên bản' });
  await expect(list).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(list).toContainText('v3');
  await expect(page.getByText('Không xác định được bản vẽ')).toHaveCount(0);
  await expect(page.getByText('Không tải được lịch sử phiên bản')).toHaveCount(0);
});
