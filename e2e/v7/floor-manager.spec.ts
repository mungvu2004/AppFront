import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QCB_PROJECT, seedQcb } from './seedQcb';

/**
 * Nhóm V7 — `projectFloors` "Quản lý tầng" (`plan.md` V7 mục 2).
 *
 * `isLoading = floorListQuery.isPending || graph === null` (`useFloorManager.ts`), và
 * không nơi nào nạp `graph` từ mạng (B-V6-01): mở thẳng thì bảng tầng treo khung
 * xương mãi. Mọi ca có hàng tầng đi qua `seedQcb` — tên bài nói ra điều đó.
 *
 * Màn KHÔNG có tự lưu: nó nói thật bằng hai câu nợ `role="status"`. Ca mồi ghim hai
 * câu ấy — đó là ghim hiện trạng "không nói sai", không phải bài đạt A7.
 *
 * Đơn vị (48 bài) đã phủ: đổi chiều cao kéo cao độ tầng trên = một bước, chặn trùng
 * cao độ, xoá tầng có vé 8 s, nhân bản. Ở đây chỉ đi đường trình duyệt thật.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const DEBT_CONTENT =
  'nội dung tầng (tường, phòng, nội thất) mới chỉ đổi trong phiên làm việc này; hệ thống chưa có chỗ lưu nó nên nó mất sau khi tải lại trang.';
const DEBT_HIDE =
  'ẩn tầng khỏi mô hình 3d chỉ có hiệu lực trong phiên làm việc này; hệ thống chưa có chỗ lưu lựa chọn đó nên nó mất sau khi tải lại trang.';

/** Hàng tầng: `<tr>` mang tên truy cập "<tên>, cao độ …" (`FloorTableRow.tsx`). */
function floorRows(page: Page) {
  return page.getByRole('row', { name: /, cao độ / });
}

function toast(page: Page) {
  return page.getByRole('region', { name: 'Thông báo' });
}

async function open(page: Page): Promise<void> {
  await page.goto(ROUTES.project.floors(QCB_PROJECT));
  await expect(page.getByRole('heading', { name: 'quản lý tầng' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openSeeded(page: Page): Promise<void> {
  await open(page);
  await seedQcb(page, 'floors');
  await expect(floorRows(page)).toHaveCount(4);
}

test('ca mồi, KHÔNG bơm: hai câu nợ nói thật mà chưa có hàng tầng nào — đỏ ngày có đường nạp thật, khi ấy xoá seedQcb (V7-FLOORS-01)', async ({
  page,
}) => {
  await open(page);

  await expect(
    page.getByRole('heading', { name: 'những thay đổi chỉ sống trong phiên làm việc này' }),
  ).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: DEBT_CONTENT })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: DEBT_HIDE })).toBeVisible();
  /* Hôm nay: khung xương, không hàng, không nút "Thêm tầng" (B-V6-01). Không khẳng
     định số khung xương — chỉ khẳng định điều người dùng thiếu. */
  await expect(floorRows(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm tầng' })).toHaveCount(0);
});

test('bơm bộ mẫu: bốn tầng, cao độ và tổng cao dùng dấu phẩy (V7-FLOORS-02, A15)', async ({ page }) => {
  await openSeeded(page);

  await expect(page.getByRole('row', { name: 'Tầng trệt, cao độ 0,0 m, cao 3,9 m, 0% đã kiểm' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Tầng hầm, cao độ -3,0 m, cao 3,0 m, 0% đã kiểm' })).toBeVisible();
  await expect(page.getByText('14,1 m').first()).toBeVisible();
  /* Hai câu nợ vẫn còn khi đã có hàng — chúng không phải câu của trạng thái rỗng. */
  await expect(page.getByRole('status').filter({ hasText: DEBT_CONTENT })).toBeVisible();
});

test('bơm bộ mẫu: thêm tầng có toast hoàn tác, bấm hoàn tác thì về bốn tầng (V7-FLOORS-03, A8)', async ({
  page,
}) => {
  await openSeeded(page);

  await page.getByRole('button', { name: 'Thêm tầng' }).click();

  await expect(floorRows(page)).toHaveCount(5);
  await expect(toast(page)).toContainText('đã thêm tầng.');

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(floorRows(page)).toHaveCount(4);
  await expect(page.getByText('14,1 m').first()).toBeVisible();
});

/* Xoá tầng chủ ý KHÔNG hỏi (A8/D-05): an toàn của nó nằm hết ở vé hoàn tác. */
test('bơm bộ mẫu: xoá tầng không hỏi, toast hoàn tác trả tầng về (V7-FLOORS-03, A8)', async ({ page }) => {
  await openSeeded(page);

  await page.getByRole('button', { name: 'Thao tác khác cho tầng Tầng 2' }).click();
  await page.getByRole('menuitem', { name: 'xoá tầng' }).click();

  await expect(floorRows(page)).toHaveCount(3);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(toast(page)).toContainText('Đã xoá tầng Tầng 2.');

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(floorRows(page)).toHaveCount(4);
  await expect(page.getByRole('row', { name: /^Tầng 2, cao độ/u })).toBeVisible();
});
