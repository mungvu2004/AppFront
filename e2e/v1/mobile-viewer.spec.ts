import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';

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
const EMPTY_TITLE = 'chưa có mô hình để xem';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(PHONE);
});

test('mở bản điện thoại của một dự án: tên dự án đến từ API, thanh công cụ có mặt', async ({
  page,
}) => {
  await page.goto(ROUTES.mobileViewer(PROJECT_ID));

  const screen = page.getByRole('region', { name: 'xem mô hình 3D trên điện thoại', exact: true });
  await expect(screen).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  // Tên mặc định đứng đó cho tới khi truy vấn về — chờ tên thật, không đọc một lần.
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText(PROJECT_NAME);
  await expect(screen.getByRole('button', { name: 'chia sẻ dự án', exact: true })).toBeVisible();
});

/*
 * B-V1-03 — chờ quyết. Route chỉ truyền `projectId` + `roles`
 * (`MobileViewer.container.tsx`), hình học đọc từ `store.spatial`
 * (`useMobileViewer.ts:249-250`) mà không gì trên đường này nạp nó, và không có
 * request hình học nào. Nên bản điện thoại LUÔN nói "chưa có mô hình để xem".
 */
test.fixme(
  'mở bản điện thoại của một dự án có mô hình thì thấy mô hình, không thấy "chưa có mô hình để xem"',
  // Lý do: chọn đường nạp hình học cho route này là quyết định kiến trúc dữ liệu (cùng gốc
  // với bảy màn QC, Q1 = A′) — B-V1-03.
  // Mở lại khi: route `/m/du-an/:projectId` có nguồn hình học thật.
  async ({ page }) => {
    await page.goto(ROUTES.mobileViewer(PROJECT_ID));

    const screen = page.getByRole('region', { name: 'xem mô hình 3D trên điện thoại', exact: true });
    await expect(screen.getByRole('heading', { level: 1 })).toHaveText(PROJECT_NAME, {
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
    await expect(screen.getByText(EMPTY_TITLE, { exact: true })).toHaveCount(0);
  },
);
