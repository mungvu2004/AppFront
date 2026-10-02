import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * V12a — `projectData`, màn Spatial JSON (`docs/notes/e2e/plan.md` V12 mục 5).
 *
 * Ca duy nhất trong nhóm tách "định dạng số" khỏi "dữ liệu thô": cây là chữ người đọc nên
 * dấu thập phân là dấu phẩy (A15); tab JSON là cú pháp JSON nên `248.6` là ĐÚNG ở đó.
 * DA-3 (tìm/mở cây) bỏ: đơn vị đã phủ (`SpatialJsonViewer.test.tsx`). DA-4 bỏ: đầu vào
 * sai dạng không bao giờ vào kho ở sản phẩm.
 */

const DATA_URL = ROUTES.project.data('project-1');

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hằng `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const EMPTY_TITLE = 'Chưa có dữ liệu không gian';

/** Ô tìm của thanh công cụ — có ở mọi trạng thái; cùng mốc `smoke-grid.spec.ts`. */
const SCREEN_ANCHOR = 'Tìm theo khoá hoặc giá trị';

test('ca mồi, không bơm: màn dữ liệu nói chưa có dữ liệu và không tự khen "hợp lệ, 0 lỗi" khi chưa có gì để kiểm (B-V12-07)', async ({
  page,
}) => {
  await page.goto(DATA_URL);

  await expect(page.getByLabel(SCREEN_ANCHOR)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toBeVisible();
  await expect(
    page.getByText(
      'Bản vẽ này chưa được xử lý xong, nên chưa có Spatial JSON để xem. Chạy pipeline cho tầng rồi quay lại đây.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/Hợp lệ theo hợp đồng Spatial JSON/u)).toHaveCount(0);
});

test('có bơm kho: cây dùng dấu phẩy thập phân, tab JSON giữ dấu chấm của cú pháp JSON, số dòng ẩn có dấu nghìn (A15, B-V12-08)', async ({
  page,
}) => {
  await page.goto(DATA_URL);
  await expect(page.getByLabel(SCREEN_ANCHOR)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(page.getByRole('heading', { name: EMPTY_TITLE })).toBeVisible();
  await seedSpatial(page);

  const tree = page.getByRole('tree', { name: 'Cấu trúc dữ liệu không gian' });
  await expect(tree.getByRole('treeitem').filter({ hasText: /grossFloorAreaM2/u }).first()).toContainText(
    /\d,\d{2}/u,
  );
  await expect(tree).not.toContainText(/\d\.\d{1,2}(?!\d)/u);

  await page.getByRole('tab', { name: 'JSON' }).click();
  // Tab không có `tabpanel` đi kèm (`SpatialJsonDetail.tsx`) — neo vào vùng nội dung có tên.
  const raw = page.getByRole('region', { name: 'Nội dung dữ liệu không gian' });
  await expect(raw).toContainText(/"grossFloorAreaM2": \d+\.\d/u);
  await expect(raw).toContainText(/Còn \d{1,3}(\.\d{3})+ dòng nữa/u);
});
