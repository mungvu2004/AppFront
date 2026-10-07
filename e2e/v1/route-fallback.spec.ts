import { expect, test } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH, pathOf } from '../fixtures/routes';

/**
 * Vỏ chờ lúc chunk của màn kế tiếp còn trên đường (B-G-04).
 *
 * Trên mạng chậm người dùng nhìn đúng vỏ này — từng là chữ tiếng Anh `Loading...`
 * ở góc một màn trống (A6, A11). Bài giữ chunk lại bằng một cổng tự mở, không bằng
 * một khoảng chờ: thấy vỏ chờ → mở cổng → thấy màn.
 *
 * Cổng giữ MỌI lượt xin script sau khi màn đầu đã dựng xong, không neo vào đường tệp
 * của chunk: máy chủ dev phục vụ `/src/...`, bản dựng phục vụ `/assets/<băm>`, và
 * lượt chuyển màn này cần cả module của màn lẫn phụ thuộc của nó. Lượt chuyển màn
 * PHẢI xin ít nhất một script — nếu không, bài đỏ ở chỗ chờ vỏ, không xanh giả.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const PENDING_LABEL = 'Đang tải màn hình';

test('chuyển sang màn chưa tải: vỏ chờ tiếng Việt, không có "Loading...", rồi màn hiện ra', async ({
  page,
}) => {
  await page.goto(UNKNOWN_PATH);
  const toDashboard = page.getByRole('button', { name: 'Về danh sách dự án', exact: true });
  await expect(toDashboard).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  let release: () => void = () => undefined;
  const gate = new Promise<void>((open) => {
    release = open;
  });
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await gate;
    await route.continue();
  });

  await toDashboard.click();

  await expect(page.getByRole('status', { name: PENDING_LABEL, exact: true })).toBeVisible();
  await expect(page.getByText('Loading...', { exact: true })).toHaveCount(0);

  release();

  await expect(page.getByRole('heading', { name: 'Dự án của tôi', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('status', { name: PENDING_LABEL, exact: true })).toHaveCount(0);
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

/*
 * B-V1-43 — dự án không có (hoặc người dùng không phải thành viên) trên route bọc
 * `ProjectSpatialGate`: từng kẹt ở khung "không tìm thấy" không nút, không lối ra.
 * `project-missing` là id mà bộ mẫu API trả 404 `resource: 'project'`.
 */
test('B-V1-43: mở dự án không có ở /3d thì có câu và nút về danh sách dự án', async ({ page }) => {
  await page.goto(ROUTES.project.viewer('project-missing'));

  await expect(page.getByRole('heading', { name: 'Không tìm thấy dự án này', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  await expect(page.getByRole('main', { name: 'Khung nhìn mô hình', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Về danh sách dự án', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Dự án của tôi', exact: true })).toBeVisible({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});
