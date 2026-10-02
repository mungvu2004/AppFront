import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ROUTES, UNKNOWN_PATH, pathOf } from '../fixtures/routes';

/**
 * Escape trên bốn màn phẳng của nhóm V1 — không lớp nào để đóng — là vô hại (A12).
 *
 * "Esc đóng lớp trên cùng" — không có lớp thì không được làm gì khác: không rời
 * ứng dụng, không đổi màn. B-G-02 (`/thong-bao`) là một màn trắng do đúng phím này.
 * Màn đăng nhập có bài riêng ở `e2e/auth/login.spec.ts`.
 *
 * Khẳng định "không có gì xảy ra" là khẳng định phủ định, nên bài đếm mọi lượt điều
 * hướng của khung chính (kể cả lượt đổi lịch sử cùng tài liệu) sau phím, qua một
 * rào hai khung hình. Một lượt lùi ra khỏi trang làm chính lời gọi rào ném lỗi.
 */

/** Lần tải đầu của một route bắt Vite dịch nguội; cùng hạn `smoke-grid.spec.ts`. */
const FIRST_PAINT_TIMEOUT_MS = 15_000;

const ROWS = [
  { name: 'onboarding', path: ROUTES.onboarding, anchor: { role: 'button', name: 'Bỏ qua' } },
  {
    name: 'accessDenied',
    path: ROUTES.accessDenied,
    anchor: { role: 'heading', name: 'bạn chưa có quyền truy cập' },
  },
  { name: 'notFound', path: UNKNOWN_PATH, anchor: { role: 'heading', name: 'không tìm thấy trang này' } },
  {
    name: 'mobileViewer',
    path: ROUTES.mobileViewer('project-1'),
    anchor: { role: 'region', name: 'xem mô hình 3D trên điện thoại' },
    viewport: { width: 390, height: 844 },
  },
] as const;

const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
  );

for (const row of ROWS) {
  test(`Escape trên màn ${row.name} không rời màn, không điều hướng`, async ({ page }) => {
    if ('viewport' in row) await page.setViewportSize(row.viewport);
    await page.goto(row.path);

    const anchor = page.getByRole(row.anchor.role, { name: row.anchor.name, exact: true });
    await expect(anchor).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });

    const navigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });

    await page.keyboard.press('Escape');
    await twoFrames(page);

    expect(navigations).toEqual([]);
    expect(pathOf(page.url())).toBe(row.path);
    await expect(anchor).toBeVisible();
  });
}
