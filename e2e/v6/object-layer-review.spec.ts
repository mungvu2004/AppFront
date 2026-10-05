import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QC_FLOOR, QC_PROJECT, seedQc } from './seedQc';

/**
 * `projectObjects` — Lớp đối tượng (`plan.md` V6 mục 2).
 *
 * Kế hoạch tự rút mục này về ít ca nếu phím chạy y hệt tường. Đo ra hai hành vi riêng của
 * màn: ba nút "chọn nhóm" khoá cứng lúc đầu (B-V6-10, đã sửa) và màn chỉ liệt kê đối tượng
 * có trong bảng mẫu cứng (B-V6-13, đã sửa: danh sách dựng từ đồ thị). Gộp lệnh, gắn tường,
 * vai: bài đơn vị.
 */

/** Lần tải đầu một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

/** Tầng 2 của bộ mẫu A14: 2 cửa đi + 2 cửa sổ trên tường của tầng, 5 bàn. */
const A14_FLOOR = 'L-LEVEL000001';
const A14_OBJECTS_ON_FLOOR = 9;

const rail = (page: Page) => page.getByRole('toolbar', { name: 'Công cụ lớp đối tượng' });

async function openSeeded(page: Page): Promise<void> {
  await page.goto(ROUTES.project.objects(QC_PROJECT, QC_FLOOR.objects));
  await expect(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedQc(page, 'objects');
  await expect(page.getByText('9/20 đối tượng đã duyệt').first()).toBeVisible();
}

test('đường nạp thật: mở thẳng màn ở một tầng có lớp thì kho được nạp — bộ đếm duyệt có mẫu số khác 0 (không bơm)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));

  /*
   * Mẫu số khác 0 nghĩa là kho đã được nạp. Kho rỗng (trước B-V6-01) cho "0/0". Đúng số đối
   * tượng là việc của ca B-V6-13 ngay dưới.
   */
  await expect(
    page.getByRole('status', { name: 'Thanh trạng thái' }).getByText(/^\d+\/[1-9]\d* đối tượng đã duyệt$/u),
  ).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
});

test('đường nạp thật: màn liệt kê đúng ô mở và nội thất của tầng từ đồ thị, không bịa dòng mồ côi #D-009 (B-V6-13)', async ({
  page,
}) => {
  /*
   * Trước B-V6-13 `objectsOf` lặp bảng mẫu cứng `OBJECT_LAYER_SEED` thay vì đồ thị: ở tầng này
   * màn hiện đúng một dòng "#D-009 — 0/1" lấy từ bảng mẫu, trong khi đồ thị có 9 đối tượng.
   */
  await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));

  await expect(page.getByText(`0/${String(A14_OBJECTS_ON_FLOOR)} đối tượng đã duyệt`).first()).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('option')).toHaveCount(A14_OBJECTS_ON_FLOOR);
  await expect(page.getByRole('option', { name: /^#D-009/u })).toHaveCount(0);
});

test('[bơm] ba nút "chọn nhóm" bấm được bằng chuột ngay từ đầu (B-V6-10)', async ({ page }) => {
  await openSeeded(page);

  const door = rail(page).getByRole('button', { name: 'chọn nhóm cửa đi (phím D)' });
  await expect(door).toBeEnabled();
  await door.click();

  /* Nhóm đã chọn thì ray mở các ô loại con của nó. */
  await expect(rail(page).getByRole('button', { name: /^Đổi thành .* \(phím 1\)$/u })).toBeVisible();
});

test('[bơm] phím D chọn nhóm qua sổ phím thật, Escape bỏ chọn đối tượng (O-1)', async ({ page }) => {
  await openSeeded(page);

  await page.keyboard.press('d');
  await expect(rail(page).getByRole('button', { name: /^Đổi thành .* \(phím 1\)$/u })).toBeVisible();

  const first = page.getByRole('option').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
});

/*
 * Trước B-V6-03 mỗi lệnh bắn một lượt ghi lạc quan vào `persistObjectLayer: false` — không
 * lượt nào rời khỏi máy và không một lời nào cho trình đọc màn hình. Nay màn tự lưu 800 ms
 * sau thao tác cuối qua #35 và nói ra kết quả (vùng `role="status"` của bộ đọc dùng chung —
 * màn này không có chữ lưu nhìn thấy được).
 */
test('[bơm] duyệt một đối tượng thì hệ thống tự lưu và trình đọc màn hình nghe "Đã lưu lúc …" (A7, B-V6-03)', async ({
  page,
}) => {
  await openSeeded(page);

  await page.getByRole('option', { name: /^#D-004 /u }).click();
  await page.getByRole('button', { name: 'Duyệt đối tượng này' }).click();
  await expect(page.getByText('10/20 đối tượng đã duyệt').first()).toBeVisible();

  await expect(page.getByRole('status').filter({ hasText: /^Đã lưu lúc \d{2}:\d{2}$/u })).toHaveCount(1);
});

/** Tầng 1 của bộ mẫu A14 (10 đối tượng) — tầng đang có trong kho khi ca dưới đổi URL sang nó. */
const A14_FIRST_FLOOR = 'L-LEVEL000000';

/** Đổi URL sang tầng khác ngay trong trang (không tải lại), để kho vẫn giữ đồ thị đã nạp. */
async function switchFloorInPage(page: Page, floorId: string): Promise<void> {
  const target = ROUTES.project.objects(QC_PROJECT, floorId);

  await page.evaluate((url) => {
    history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, target);
}

test('mã tầng của URL không có trong kho thì màn báo rỗng, không hiện và cho sửa đồ của tầng khác (B-V6-40)', async ({
  page,
}) => {
  await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));
  await expect(page.getByText(`0/${String(A14_OBJECTS_ON_FLOOR)} đối tượng đã duyệt`).first()).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await switchFloorInPage(page, A14_FIRST_FLOOR);

  await expect(page.getByRole('button', { name: 'thêm thủ công' })).toBeVisible();
  await expect(page.getByText(`0/${String(A14_OBJECTS_ON_FLOOR)} đối tượng đã duyệt`)).toHaveCount(0);
});

test.fixme('mở tầng khác của cùng dự án ngay trong trang thì màn đọc được đối tượng của tầng ấy (B-V6-71)', async ({
  page,
}) => {
  /* Chờ B-V6-71 (kho chỉ giữ một đồ thị). Mở lại khi B-V6-71 được sửa. */
  await page.goto(ROUTES.project.objects(QC_PROJECT, A14_FLOOR));
  await expect(page.getByText(`0/${String(A14_OBJECTS_ON_FLOOR)} đối tượng đã duyệt`).first()).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await switchFloorInPage(page, A14_FIRST_FLOOR);

  await expect(page.getByText('0/10 đối tượng đã duyệt').first()).toBeVisible();
});
