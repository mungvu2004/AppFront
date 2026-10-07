import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { seedSpatial } from '../fixtures/seedSpatial';

/**
 * Xem 3D trên điện thoại (V1-MOBILE) — chỗ người nhận một liên kết chia sẻ mở dự án
 * trên máy của họ.
 *
 * Đơn vị (86 bài / 6 tệp) dựng đủ bảy trạng thái nhưng TIÊM `spatial` thẳng vào hook,
 * nên chúng xanh trong khi route thật không có đường nạp hình học nào (B-V1-03). Bài
 * e2e là phép đo duy nhất đi đúng đường của người dùng.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const PHONE = { width: 390, height: 844 } as const;
const PROJECT_ID = 'project-1';
/** Tên dự án mà bộ mẫu API trả cho `project-1` (`src/api/__mocks__`). */
const PROJECT_NAME = 'Chung cư Hoàng Anh';
const EMPTY_TITLE = 'Chưa có mô hình để xem';
const WEAK_DEVICE_TITLE = 'Máy này chưa dựng nổi mô hình 3D';
/** Bốn tầng của `MOCK_SPATIAL_PROJECT` và cũng bốn tầng của bộ mẫu A14. */
const MOCK_FLOOR_COUNT = 4;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(PHONE);
});

test('mở bản điện thoại của một dự án: tên dự án đến từ API, thanh công cụ có mặt', async ({
  page,
}) => {
  await page.goto(ROUTES.mobileViewer(PROJECT_ID));

  const screen = page.getByRole('region', { name: 'Xem mô hình 3D trên điện thoại', exact: true });
  await expect(screen).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  // Tên mặc định đứng đó cho tới khi truy vấn về — chờ tên thật, không đọc một lần.
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(PROJECT_NAME);
  // F-06 (E6=B): liên kết chia sẻ là v2 — bản v1 không có nút chia sẻ, nút rời DOM.
  await expect(screen.getByRole('button', { name: 'Chia sẻ dự án', exact: true })).toHaveCount(0);
});

/*
 * B-V1-03 — đường nạp thật. Route bọc `ProjectSpatialGate`, nên kho dự án được nạp từ
 * máy chủ giả. Mock `project-1` có đúng bốn tầng và KHÔNG có tường lẫn phòng, nên câu
 * trung thực duy nhất của bản điện thoại là "chưa có mô hình để xem" — kèm đủ bốn tầng.
 *
 * Đỏ khi mock N16 trả hình cho project-1: lúc ấy câu "chưa có mô hình" thành nói dối,
 * và bài này phải đổi sang khẳng định có mô hình.
 */
test('không bơm: bốn tầng của dự án có thật, và nói thật rằng chưa có mô hình để xem', async ({
  page,
}) => {
  await page.goto(ROUTES.mobileViewer(PROJECT_ID));

  const screen = page.getByRole('region', { name: 'Xem mô hình 3D trên điện thoại', exact: true });
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(PROJECT_NAME, {
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(screen.getByText(EMPTY_TITLE, { exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await screen.getByRole('button', { name: 'Tầng', exact: true }).click();
  const floorRows = screen.getByRole('group', { name: 'Tầng', exact: true }).getByRole('button');
  await expect(floorRows).toHaveCount(MOCK_FLOOR_COUNT);
  // B-V1-11: tầng chưa có phòng nói "chưa có phòng", không nói "chưa tải" (câu về mạng).
  await expect(floorRows.first()).toHaveAccessibleName(/^Tầng hầm Chưa có phòng/u);
  await expect(screen.getByText(/^chưa tải$/iu)).toHaveCount(0);
});

test('bơm bộ mẫu A14 vào dự án đã nạp: thấy mô hình, không thấy "chưa có mô hình để xem"', async ({
  page,
}) => {
  await page.goto(ROUTES.mobileViewer(PROJECT_ID));

  const screen = page.getByRole('region', { name: 'Xem mô hình 3D trên điện thoại', exact: true });
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(PROJECT_NAME, {
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await seedSpatial(page, { projectId: PROJECT_ID });

  await expect(screen.getByText(EMPTY_TITLE, { exact: true })).toHaveCount(0);
  await expect(screen.getByText(WEAK_DEVICE_TITLE, { exact: true })).toHaveCount(0);

  await screen.getByRole('button', { name: 'Tầng', exact: true }).click();
  const floorRows = screen.getByRole('group', { name: 'Tầng', exact: true }).getByRole('button');
  // Bơm thay `floors` bằng bốn tầng của bộ mẫu (`Level 0..3`), có phòng nên không tầng nào "chưa có phòng".
  await expect(floorRows).toHaveCount(MOCK_FLOOR_COUNT);
  await expect(floorRows.first()).toHaveAccessibleName(/^Level 0/u);
  await expect(screen.getByText('chưa có phòng', { exact: true })).toHaveCount(0);
});
