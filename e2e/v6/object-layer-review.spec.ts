import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QC_FLOOR, QC_PROJECT, seedQc } from './seedQc';

/**
 * `projectObjects` — Lớp đối tượng (`plan.md` V6 mục 2).
 *
 * Kế hoạch tự rút mục này về ít ca nếu phím chạy y hệt tường. Đo ra hai hành vi riêng của
 * màn: ba nút "chọn nhóm" khoá cứng lúc đầu (B-V6-10, đã sửa) và màn chỉ liệt kê đối tượng
 * có trong bảng mẫu cứng (B-V6-13, chờ quyết). Gộp lệnh, gắn tường, vai: 42 bài đơn vị.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: 2 cửa đi + 2 cửa sổ trên tường của tầng, 5 bàn. */
const A14_FLOOR = 'L-LEVEL000001';
const A14_OBJECTS_ON_FLOOR = 9;

const rail = (page: Page) => page.getByRole('toolbar', { name: 'Công cụ lớp đối tượng' });

async function openSeeded(page: Page): Promise<void> {
  await page.goto(ROUTES.project.objects(QC_PROJECT, QC_FLOOR.objects));
  await expect(page.getByRole('region', { name: 'lớp đối tượng', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedQc(page, 'objects');
  await expect(page.getByText('9/21 đối tượng đã duyệt').first()).toBeVisible();
}

test('đường nạp thật: mở thẳng màn ở một tầng có lớp thì kho được nạp — bộ đếm duyệt có mẫu số khác 0 (không bơm)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));

  /*
   * Mẫu số khác 0 nghĩa là kho đã được nạp. Kho rỗng (trước B-V6-01) cho "0/0". Ca này KHÔNG
   * khẳng định đúng số đối tượng — số ấy đang sai vì B-V6-13 (ca fixme ngay dưới).
   */
  await expect(
    page.getByRole('status', { name: 'Thanh trạng thái' }).getByText(/^\d+\/[1-9]\d* đối tượng đã duyệt$/u),
  ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
});

test.fixme(
  'đường nạp thật: màn liệt kê đúng ô mở và nội thất của tầng từ đồ thị, không bịa dòng mồ côi #D-009 (B-V6-13)',
  async ({ page }) => {
    /*
     * Lý do fixme: `objectsOf` (objectLayerReviewGateway.ts) lặp bảng mẫu cứng
     * `OBJECT_LAYER_SEED`, không lặp đồ thị. Đo 2026-10-03 ở tầng này: màn hiện đúng một
     * dòng "#D-009 — 0/1" lấy từ bảng mẫu, trong khi đồ thị có 9 đối tượng.
     * Mở lại khi: người dùng chốt ánh xạ kind miền → loại con (mục B-V6-13) và danh sách
     * được dựng từ đồ thị.
     */
    await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));

    await expect(page.getByText(`0/${String(A14_OBJECTS_ON_FLOOR)} đối tượng đã duyệt`).first()).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
    await expect(page.getByRole('option', { name: /^#D-009/u })).toHaveCount(0);
  },
);

test('[bơm] ba nút "chọn nhóm" bấm được bằng chuột ngay từ đầu (B-V6-10)', async ({ page }) => {
  await openSeeded(page);

  const door = rail(page).getByRole('button', { name: 'chọn nhóm cửa đi (phím D)' });
  await expect(door).toBeEnabled();
  await door.click();

  /* Nhóm đã chọn thì ray mở các ô loại con của nó. */
  await expect(rail(page).getByRole('button', { name: /^đổi thành .* \(phím 1\)$/u })).toBeVisible();
});

test('[bơm] phím D chọn nhóm qua sổ phím thật, Escape bỏ chọn đối tượng (O-1)', async ({ page }) => {
  await openSeeded(page);

  await page.keyboard.press('d');
  await expect(rail(page).getByRole('button', { name: /^đổi thành .* \(phím 1\)$/u })).toBeVisible();

  const first = page.getByRole('option').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
});
