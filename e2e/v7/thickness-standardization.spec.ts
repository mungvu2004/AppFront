import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QCB_FLOOR, QCB_PROJECT, seedQcb } from './seedQcb';

/**
 * Nhóm V7 — `projectThickness` "Chuẩn hoá độ dày tường" (`plan.md` V7 mục 3).
 *
 * Màn đọc đồ thị từ `store.spatial` và không nơi nào nạp nó từ mạng (B-V6-01), nên
 * mọi ca có nội dung đi qua `seedQcb` — tên bài nói ra điều đó. Ca mồi đầu tiên
 * KHÔNG bơm: nó ghim chuỗi người dùng thấy hôm nay, và đỏ đúng ngày sản phẩm có
 * đường nạp thật (`plan.md` 6.1).
 *
 * Màn đếm CẢ CÔNG TRÌNH: URL `L-000001TFL1` ra 48 đoạn, tức đủ ba tầng của bộ mẫu
 * (mỗi tầng 16, `thicknessFixture.ts`) — đo.
 *
 * Đơn vị (35 bài) đã phủ: một lượt áp = một bước hoàn tác, kéo ngưỡng không ghi
 * lịch sử, cảnh báo áp lại. Ở đây chỉ đi những gì trình duyệt thật mới chứng minh.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const TITLE = 'chuẩn hoá độ dày tường';

/** Bốn thẻ đếm là `<p role="status">` không nhãn riêng — phân biệt bằng chữ. */
function stat(page: Page, label: string) {
  return page.getByRole('status').filter({ hasText: label });
}

/** Toast hoàn tác — không phải nút "Hoàn tác" thường trực ở chân màn. */
function toast(page: Page) {
  return page.getByRole('region', { name: 'Thông báo' });
}

async function open(page: Page): Promise<void> {
  /* Hàng nhóm là `motion.tr` có `layoutId` (260 ms): tắt chuyển động để cú bấm
     không rơi vào một hàng đang trượt. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.project.thickness(QCB_PROJECT, QCB_FLOOR.thickness));
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openSeeded(page: Page): Promise<void> {
  await open(page);
  await seedQcb(page, 'thickness');
  await expect(stat(page, 'tổng số đoạn tường')).toHaveText(/^48\s+tổng số đoạn tường$/u);
}

test('ca mồi, KHÔNG bơm: mở thẳng thì màn nói thật "chưa có đoạn tường nào" — đỏ ngày có đường nạp thật, khi ấy xoá seedQcb (V7-THICK-01)', async ({
  page,
}) => {
  await open(page);

  await expect(page.getByRole('heading', { name: 'chưa có đoạn tường nào để chuẩn hoá' })).toBeVisible();
  for (const label of ['tổng số đoạn tường', 'đã ở đúng nhóm chuẩn', 'lệch quá dung sai', 'cột bê tông cốt thép']) {
    await expect(stat(page, label)).toHaveText(new RegExp(`^0\\s+${label}$`, 'u'));
  }
});

test('bơm bộ mẫu: bốn thẻ đếm đúng bộ mẫu, số thập phân dùng dấu phẩy (V7-THICK-02, A15)', async ({ page }) => {
  await openSeeded(page);

  await expect(stat(page, 'đã ở đúng nhóm chuẩn')).toHaveText(/^3\s+đã ở đúng nhóm chuẩn$/u);
  await expect(stat(page, 'lệch quá dung sai')).toHaveText(/^6\s+lệch quá dung sai$/u);
  await expect(stat(page, 'cột bê tông cốt thép')).toHaveText(/^3\s+cột bê tông cốt thép$/u);
  await expect(
    page.getByRole('checkbox', { name: 'Đồng ý chuẩn hoá 30 tường 195 mm về 220 mm' }),
  ).not.toBeChecked();

  /* A15: không một số thập phân nào dùng dấu chấm trên cả màn. Phân nhóm nghìn
     ("4.000 mm") không có ở màn này — số đo độ dày đều dưới 1000. */
  const body = await page.locator('body').innerText();
  expect(body).toMatch(/\d,\d/u);
  expect(body).not.toMatch(/\d\.\d/u);
});

test('bơm bộ mẫu: Esc đóng đúng lớp xem trước và không rời màn (V7-THICK-03, A12)', async ({ page }) => {
  await openSeeded(page);
  const url = page.url();

  /* `exact`: "Thu gọn khung xem trước" cũng chứa cụm này. */
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(stat(page, 'tổng số đoạn tường')).toHaveText(/^48\s+tổng số đoạn tường$/u);
});

/*
 * F-T2 của kế hoạch nghi "Áp dụng không đổi gì" — đo lại thì luồng chạy đúng: lượt đo
 * cũ đã `check({ force: true })` một ô `sr-only` bị khối vẽ đè lên, rồi bấm nhầm nút.
 * Người dùng chuột bấm vào khối vẽ (nằm trong `<label>`), người dùng phím dùng Space —
 * bài đi đường phím (A12), vì `getByRole('checkbox').click()` trúng khối đè chứ không
 * trúng ô.
 */
test('bơm bộ mẫu: tích đồng ý bằng phím, xem trước, áp — 30 tường về 220 mm, toast hoàn tác trả nguyên trạng (V7-THICK-05, A8)', async ({
  page,
}) => {
  await openSeeded(page);

  const accept = page.getByRole('checkbox', { name: 'Đồng ý chuẩn hoá 30 tường 195 mm về 220 mm' });
  await accept.focus();
  await page.keyboard.press('Space');
  await expect(accept).toBeChecked();

  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  /* `exact`: "Áp dụng lại bộ lọc" đứng trước trong cây và cũng khớp. */
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();

  await expect(toast(page)).toContainText('Chuẩn hoá độ dày 30 tường.');
  await expect(stat(page, 'đã ở đúng nhóm chuẩn')).toHaveText(/^33\s+đã ở đúng nhóm chuẩn$/u);

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(stat(page, 'đã ở đúng nhóm chuẩn')).toHaveText(/^3\s+đã ở đúng nhóm chuẩn$/u);
  await expect(
    page.getByRole('checkbox', { name: 'Đồng ý chuẩn hoá 30 tường 195 mm về 220 mm' }),
  ).toBeVisible();
});
