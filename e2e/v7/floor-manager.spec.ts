import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QCB_PROJECT, seedQcb } from './seedQcb';

/**
 * Nhóm V7 — `projectFloors` "Quản lý tầng" (`plan.md` V7 mục 2).
 *
 * Từ B-V6-01 (phần V7) cổng đọc danh sách tầng rồi N16 của từng tầng khi kho rỗng
 * (`readProjectLayerGraph`) — màn không còn treo khung xương. Nhưng mã tầng của bộ mẫu
 * dev (`L-1`, `L1`, `L2`, `L3`, `src/mocks/spatial.ts`) không phải `LevelId` hợp lệ, nên
 * `levelsOf` lọc bỏ cả bốn và bảng nói "chưa có tầng nào" (B-V7-21, ngoài FE — bộ mẫu).
 * Vì thế các ca cần hàng tầng vẫn đi qua `seedQcb` — tên bài nói ra điều đó.
 *
 * Nội dung tầng và "ẩn khỏi 3D" chưa có đầu máy chủ (B-V7-12): màn nói thật bằng hai câu
 * nợ `role="status"`.
 *
 * Đơn vị (48 bài) đã phủ: đổi chiều cao kéo cao độ tầng trên = một bước, chặn trùng
 * cao độ, xoá tầng có vé 8 s, nhân bản. Ở đây chỉ đi đường trình duyệt thật.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const DEBT_CONTENT =
  'Nội dung tầng (tường, phòng, nội thất) mới chỉ đổi trong phiên làm việc này; hệ thống chưa có chỗ lưu nó nên nó mất sau khi tải lại trang.';
const DEBT_HIDE =
  'Ẩn tầng khỏi mô hình 3d chỉ có hiệu lực trong phiên làm việc này; hệ thống chưa có chỗ lưu lựa chọn đó nên nó mất sau khi tải lại trang.';

/** Hàng tầng: `<tr>` mang tên truy cập "<tên>, cao độ …" (`FloorTableRow.tsx`). */
function floorRows(page: Page) {
  return page.getByRole('row', { name: /, cao độ / });
}

function toast(page: Page) {
  return page.getByRole('region', { name: 'Thông báo' });
}

async function open(page: Page): Promise<void> {
  await page.goto(ROUTES.project.floors(QCB_PROJECT));
  await expect(page.getByRole('heading', { name: 'Quản lý tầng' })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openSeeded(page: Page): Promise<void> {
  await open(page);
  await seedQcb(page, 'floors');
  await expect(floorRows(page)).toHaveCount(4);
}

test('đường nạp thật: mở thẳng thì màn không treo khung xương — có nút "Thêm tầng", hai câu nợ nói thật (V7-FLOORS-01, B-V6-01)', async ({
  page,
}) => {
  await open(page);

  /* Nút "Thêm tầng" chỉ vắng khi bảng còn khung xương (`isLoading`) — trước B-V6-01 là mãi. */
  await expect(page.getByRole('button', { name: 'Thêm tầng' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Những thay đổi chỉ sống trong phiên làm việc này' }),
  ).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: DEBT_CONTENT })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: DEBT_HIDE })).toBeVisible();
});

test.fixme(
  'đường nạp thật: bảng hiện đủ bốn tầng của danh sách tầng, không nói "chưa có tầng nào" (B-V7-21)',
  /*
   * Lý do fixme: kho đã có bốn tầng đọc qua N16 (đo: `byKind.level` = L-1, L1, L2, L3), nhưng
   * mã tầng của bộ mẫu dev không phải `LevelId` hợp lệ (`L-<thân ≥10 ký tự>`,
   * `src/domain/spatial/ids.ts`), nên `isEntityOfKind('level', …)` của `levelsOf` bỏ cả bốn.
   * BE thật trả mã hợp lệ. Đổi mã tầng của bộ mẫu chạm mọi bài đang dùng `L1` — quyết của
   * điều phối viên.
   * Mở lại khi: bộ mẫu dev phát mã tầng hợp lệ (hoặc màn tầng không lọc theo khuôn mã).
   */
  async ({ page }) => {
    await open(page);

    await expect(floorRows(page)).toHaveCount(4);
  },
);

test('bơm bộ mẫu: bốn tầng, cao độ và tổng cao dùng dấu phẩy (V7-FLOORS-02, A15)', async ({ page }) => {
  await openSeeded(page);

  await expect(page.getByRole('row', { name: 'Tầng trệt, cao độ 0,0 m, cao 3,9 m, 0% đã kiểm' })).toBeVisible();
  await expect(page.getByRole('row', { name: 'Tầng hầm, cao độ -3,0 m, cao 3,0 m, 0% đã kiểm' })).toBeVisible();
  await expect(page.getByText('14,1 m').first()).toBeVisible();
  /* Hai câu nợ vẫn còn khi đã có hàng — chúng không phải câu của trạng thái rỗng. */
  await expect(page.getByRole('status').filter({ hasText: DEBT_CONTENT })).toBeVisible();
});

test('bơm bộ mẫu: thang cao độ là một nhóm có tên "Thang cao độ" (B-V6-44)', async ({ page }) => {
  await openSeeded(page);

  await expect(page.getByRole('group', { name: 'Thang cao độ', exact: true })).toBeVisible();
});

test('bơm bộ mẫu: thêm tầng có toast hoàn tác, bấm hoàn tác thì về bốn tầng (V7-FLOORS-03, A8)', async ({
  page,
}) => {
  await openSeeded(page);

  await page.getByRole('button', { name: 'Thêm tầng' }).click();

  await expect(floorRows(page)).toHaveCount(5);
  await expect(toast(page)).toContainText('Đã thêm tầng.');

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
