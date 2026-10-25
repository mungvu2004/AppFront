import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

import { QCB_FLOOR, QCB_PROJECT, seedQcb } from './seedQcb';

/**
 * Nhóm V7 — `projectThickness` "Chuẩn hoá độ dày tường" (`plan.md` V7 mục 3).
 *
 * Hai loại bài, tên bài nói ra mình thuộc loại nào:
 * - **đường nạp thật** — KHÔNG bơm. Từ B-V6-01 (phần V7) màn đọc N16 khi kho rỗng: tầng
 *   A14 `L-LEVEL000001` cho 12 tường 220 mm, tầng khác cho lớp rỗng. Ca mồi của
 *   `plan.md` 6.1 đỏ đúng thiết kế ngày ấy, nên nó thành bài khẳng định đường thật.
 * - **bơm bộ mẫu** — bộ riêng của màn: các ca chuẩn hoá cần những tường LỆCH chuẩn, mà
 *   tầng A14 không có. Màn đếm CẢ đồ thị trong kho: URL `L-000001TFL1` ra 16 đoạn: lớp
 *   theo tầng từ F-04x (5acd859f, de24e523), mỗi tầng 16 (`thicknessFixture.ts`) — đo.
 *
 * Đơn vị đã phủ: một lượt đổi = một bước hoàn tác, kéo ngưỡng không ghi lịch sử, tường
 * đã duyệt đứng ngoài lô (bản Z, S-21). Ở đây chỉ đi những gì trình duyệt thật mới chứng minh.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; tiền lệ `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const TITLE = 'Chuẩn hoá độ dày tường';

/** Tầng 2 của bộ mẫu A14 qua N16: 12 tường ngăn, đều 220 mm. */
const A14_FLOOR = 'L-LEVEL000001';
const A14_WALLS_ON_FLOOR = 12;

/** Câu trạng thái dưới H1 (bản Z, S-21): "x/y đoạn không chuẩn, z đúng chuẩn". */
function status(page: Page) {
  return page.getByText(/đoạn không chuẩn,/u);
}

/** Toast hoàn tác — không phải nút "Hoàn tác" thường trực ở chân màn. */
function toast(page: Page) {
  return page.getByRole('region', { name: 'Thông báo' });
}

async function open(page: Page, floorId: string = QCB_FLOOR.thickness): Promise<void> {
  /* Hàng nhóm là `motion.tr` có `layoutId` (260 ms): tắt chuyển động để cú bấm
     không rơi vào một hàng đang trượt. */
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.project.thickness(QCB_PROJECT, floorId));
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
}

async function openSeeded(page: Page): Promise<void> {
  await open(page);
  await seedQcb(page, 'thickness');
  /* 16 đoạn/tầng: lớp theo tầng từ F-04x (5acd859f, de24e523); trước đó màn đếm cả 48 của ba tầng.
     Luật S-21 (dung sai 30 mm): 195/110/220/330/360 là chuẩn; 274 đổi về 220; 70 mm xem tay. */
  await expect(status(page)).toHaveText('2/16 đoạn không chuẩn, 14 đúng chuẩn');
}

test('đường nạp thật: mở thẳng ở một tầng có lớp thì câu trạng thái đọc tường từ máy chủ (V7-THICK-01, B-V6-01)', async ({
  page,
}) => {
  await open(page, A14_FLOOR);

  await expect(status(page)).toHaveText(
    `0/${String(A14_WALLS_ON_FLOOR)} đoạn không chuẩn, ${String(A14_WALLS_ON_FLOOR)} đúng chuẩn`,
  );
  await expect(page.getByRole('heading', { name: 'Chưa có đoạn tường nào để chuẩn hoá' })).toHaveCount(0);
});

/* P20 (N1-02): breadcrumb chung `QcFloorNav` "Dự án › <tầng> › Độ dày tường" thay chữ "Dự án > Độ dày tường". */
test('đường dẫn đầu màn không gõ cứng "Tầng 01": "Dự án › Tầng › Độ dày tường" (B-V6-43, N1-02)', async ({
  page,
}) => {
  await open(page);

  const breadcrumb = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
  /* Mục đầu là tên dự án thật (AppLayout nhớ), chỉ rơi về "Dự án" khi chưa biết tên: đo cấu trúc ba mục. */
  await expect(breadcrumb).toHaveText(/^.+›.+›Độ dày tường$/u);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Độ dày tường');
  await expect(breadcrumb).not.toContainText('Tầng 01');
});

test('đường nạp thật: tầng chưa có lớp thì màn nói thật "chưa có đoạn tường nào" (V7-THICK-01)', async ({ page }) => {
  await open(page, 'L1');

  await expect(page.getByRole('heading', { name: 'Chưa có đoạn tường nào để chuẩn hoá' })).toBeVisible();
  await expect(page.getByText('Chưa có số đo', { exact: true })).toBeVisible();
  await expect(status(page)).toHaveCount(0);
});

test('bơm bộ mẫu: nhóm không tích sẵn, đoạn xem tay đứng ngoài lô, không số thập phân dấu chấm (V7-THICK-02, A15)', async ({ page }) => {
  await openSeeded(page);

  await expect(page.getByRole('checkbox', { name: 'Đồng ý đổi các đoạn 274 mm về 220 mm' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Chọn nhóm này (1 đoạn)' })).toBeVisible();
  await expect(page.getByText('Nghi AI nhận nhầm', { exact: true })).toBeVisible();

  /* A15: không một số thập phân nào dùng dấu chấm trên cả màn. */
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\d\.\d/u);
});

test('bơm bộ mẫu: Esc đóng ngăn kéo bảng từng đoạn và không rời màn (V7-THICK-03, A12)', async ({ page }) => {
  await openSeeded(page);
  const url = page.url();

  await page.getByRole('button', { name: 'Xem bảng từng đoạn (16)' }).click();
  await expect(page.getByRole('dialog', { name: 'Bảng từng đoạn tường' })).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('dialog', { name: 'Bảng từng đoạn tường' })).toHaveCount(0);
  expect(page.url()).toBe(url);
  await expect(status(page)).toHaveText('2/16 đoạn không chuẩn, 14 đúng chuẩn');
});

/* Đường phím (A12): Space tích nhóm, rồi nút chính "Đổi 1 đoạn". */
test('bơm bộ mẫu: tích nhóm bằng phím, đổi — 1 tường về 220 mm, toast hoàn tác trả nguyên trạng (V7-THICK-05, A8)', async ({
  page,
}) => {
  await openSeeded(page);

  const accept = page.getByRole('checkbox', { name: 'Đồng ý đổi các đoạn 274 mm về 220 mm' });
  await accept.focus();
  await page.keyboard.press('Space');
  await expect(accept).toBeChecked();

  await page.getByRole('button', { name: /^Đổi 1 đoạn/u }).click();

  await expect(toast(page)).toContainText('Chuẩn hoá độ dày 1 tường.');
  await expect(status(page)).toHaveText('1/16 đoạn không chuẩn, 15 đúng chuẩn');

  await toast(page).getByRole('button', { name: 'Hoàn tác' }).click();

  await expect(status(page)).toHaveText('2/16 đoạn không chuẩn, 14 đúng chuẩn');
  await expect(page.getByRole('checkbox', { name: 'Đồng ý đổi các đoạn 274 mm về 220 mm' })).not.toBeChecked();
});
