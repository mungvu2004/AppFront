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
  page.getByRole('heading', { name: 'Dự án của tôi', exact: true });

/** Mọi đường khung chính đi qua — kể cả lượt đổi lịch sử cùng tài liệu. */
function recordTrail(page: Page): string[] {
  const trail: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) trail.push(pathOf(frame.url()));
  });
  return trail;
}

test('"Bỏ qua" đưa người dùng mới tới danh sách dự án', async ({ page }) => {
  await page.goto(ROUTES.onboarding);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('bắt đầu trong ba bước', {
    timeout: FIRST_PAINT_TIMEOUT_MS,
  });

  await skipButton(page).click();

  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  expect(pathOf(page.url())).toBe(ROUTES.dashboard);
});

test('"Xem hướng dẫn 2 phút" đang tắt: Enter trên nó không đi đâu, dù nó vẫn trong thứ tự Tab', async ({
  page,
}) => {
  await page.goto(ROUTES.onboarding);

  const guide = page.getByRole('button', { name: 'Xem hướng dẫn 2 phút', exact: true });
  await expect(guide).toHaveAttribute('aria-disabled', 'true', { timeout: FIRST_PAINT_TIMEOUT_MS });
  /* Ghi vệt SAU khi màn đã dựng: lúc khởi động react-router tự `replaceState` mục lịch sử
     đầu (gắn `idx`), và Playwright đếm đó là một lượt điều hướng cùng tài liệu. */
  const trail = recordTrail(page);
  await guide.focus();
  await expect(guide).toBeFocused();
  await page.keyboard.press('Enter');

  /* Rào dương thay cho chờ một khoảng: điều hướng của màn này đi sau một nhịp chuyển
     động, nên cú Enter — nếu nó điều hướng — phải hiện trong vệt TRƯỚC lượt "Bỏ qua". */
  await skipButton(page).click();
  await expect(dashboardHeading(page)).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

  expect(trail).toEqual([ROUTES.dashboard]);
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
