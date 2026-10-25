import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, pathOf } from '../fixtures/routes';

/**
 * Màn chào (V1-ONBOARDING) — màn đầu tiên người dùng mới thấy. Đỏ ở đây thì họ kẹt
 * ở màn chào hoặc không biết bắt đầu từ đâu.
 *
 * Đơn vị (`WelcomeScreen.test.tsx`, 25 bài) đã phủ bảy trạng thái, chữ, logic từng
 * bước và việc ghi cờ đã-xem. Ở đây chỉ có thứ cần router thật.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const skipButton = (page: Page) => page.getByRole('button', { name: 'Bỏ qua', exact: true });
const dashboardHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true });

test('"Bỏ qua" đưa người dùng mới tới danh sách dự án', async ({ page }) => {
  await page.goto(ROUTES.onboarding);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bắt đầu dự án đầu tiên trong ba bước', {
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await skipButton(page).click();

  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

/*
 * G1-23: hai lối phụ chưa có thật ("Xem hướng dẫn 2 phút" từng là nút tắt trong thứ tự Tab,
 * "Xem dự án mẫu" chỉ về trang chủ) nay bị ẩn hẳn. Ý ban đầu giữ nguyên: màn chào không bày
 * một lối cụt nào cho bàn phím.
 */
test('màn chào không bày lối cụt: "Xem hướng dẫn 2 phút" và "Xem dự án mẫu" không còn, "Bỏ qua" vẫn có (G1-23)', async ({
  page,
}) => {
  await page.goto(ROUTES.onboarding);
  await expect(skipButton(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await expect(page.getByRole('button', { name: 'Xem hướng dẫn 2 phút', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem dự án mẫu', exact: true })).toHaveCount(0);
});

/*
 * B-V1-04 — đã sửa. Màn ghi cờ đã-xem (`appfront:onboarding-welcome-seen:<userId>`);
 * `WelcomeRoute` đọc nó một lần lúc gắn, và ai đã xem thì về thẳng `/`.
 */
test('đã "Bỏ qua" rồi thì mở lại /onboarding không thấy lại màn chào', async ({ page }) => {
  await page.goto(ROUTES.onboarding);
  await skipButton(page).click({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  await page.goto(ROUTES.onboarding);

  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await expect(skipButton(page)).toHaveCount(0);
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});
