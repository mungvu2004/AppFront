import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH, pathOf } from '../fixtures/routes';
import { EMAIL_BY_ROLE, submitSignInForm } from '../fixtures/session';

/**
 * Lối ra của hai màn hệ thống (V1-ACCESSDENIED, V1-NOTFOUND).
 *
 * Người tới đây là người đã lạc — gõ nhầm, bấm liên kết cũ, bị từ chối. Đỏ ở đây thì
 * họ không có đường về: lối ra duy nhất làm đổ màn kế tiếp (B-G-01), hoặc đưa họ ra
 * khỏi ứng dụng (B-V1-01). Đơn vị đã phủ chữ và bảy trạng thái của hai màn; ở đây chỉ
 * có thứ cần router và bộ đệm thật: màn KẾ TIẾP có dựng nổi không.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const DASHBOARD_HEADING = 'Dự án của tôi';
const TO_DASHBOARD = 'về danh sách dự án';

function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const dashboardHeading = (page: Page) =>
  page.getByRole('heading', { name: DASHBOARD_HEADING, exact: true });

const EXIT_ROWS = [
  { name: 'màn không có quyền', path: ROUTES.accessDenied, heading: 'bạn chưa có quyền truy cập' },
  // B-G-01: 404 ghi bộ đệm danh sách dự án theo hình dạng API, bảng điều khiển đọc nó và đổ.
  { name: 'màn 404', path: UNKNOWN_PATH, heading: 'không tìm thấy trang này' },
  { name: 'màn 404 của một đường sâu có query và hash', path: '/a/b/c?x=1#h', heading: 'không tìm thấy trang này' },
] as const;

for (const row of EXIT_ROWS) {
  test(`từ ${row.name}, "${TO_DASHBOARD}" dựng được bảng điều khiển, không lỗi trang`, async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await page.goto(row.path);

    await expect(page.getByRole('heading', { name: row.heading, exact: true })).toBeVisible({
      timeout: FIRST_PAINT_TIMEOUT_MS,
    });
    // Route bắt-hết không đổi đường dẫn: người dùng còn thấy mình đã gõ gì.
    expect(pathOf(page.url())).toBe(row.path);

    await page.getByRole('button', { name: TO_DASHBOARD, exact: true }).click();

    await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
    expect(pathOf(page.url())).toBe(ROUTES.dashboard);
    expect(pageErrors).toEqual([]);
  });
}

test('mở thẳng một đường chết rồi bấm "quay lại" thì về danh sách dự án, không ra khỏi ứng dụng (B-V1-01)', async ({
  page,
}) => {
  await page.goto(UNKNOWN_PATH);
  const origin = new URL(page.url()).origin;

  await page.getByRole('button', { name: 'quay lại', exact: true }).click({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  expect(new URL(page.url()).origin).toBe(origin);
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

test('hàng dự án gần đây của màn 404 dẫn tới đúng dự án', async ({ page }) => {
  await page.goto(UNKNOWN_PATH);

  // Số hàng là của bộ mẫu; giới hạn số hàng là việc của đơn vị (`NotFound.test.tsx`).
  const firstProject = page.getByRole('link', { name: /Chung cư Hoàng Anh/ }).first();
  await expect(firstProject).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  const href = await firstProject.getAttribute('href');

  await firstProject.click();

  await expect.poll(() => pathOf(page.url())).toBe(href);
});

test('từ màn không có quyền, đăng nhập bằng tài khoản khác rồi quay lại đúng màn ấy', async ({
  page,
}) => {
  await page.goto(ROUTES.accessDenied);

  await page.getByRole('button', { name: 'đăng nhập bằng tài khoản khác', exact: true }).click({
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });
  // Nút đăng xuất trước rồi mới sang /login kèm `state.from` (`useAccessDenied.ts:439-445`).
  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.login);

  await submitSignInForm(page, EMAIL_BY_ROLE.engineer);

  await expect.poll(() => pathOf(page.url())).toBe(ROUTES.accessDenied);
  await expect(
    page.getByRole('heading', { name: 'bạn chưa có quyền truy cập', exact: true }),
  ).toBeVisible();
});
