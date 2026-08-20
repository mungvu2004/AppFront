import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The motion demo, driven rather than photographed.
 *
 * The visual spec proves the screen draws; this one proves it is actually wired
 * to `src/lib/motion` — that the timings on screen come from the orchestrator
 * and change when the conditions do, rather than being text somebody typed.
 */

const openMotionScreen = async (page: Page): Promise<void> => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Motion & Transitions' }).click();
  await expect(page.getByRole('heading', { name: 'Chuyển cảnh và nhịp' })).toBeVisible();
};

test('times each kind of handover from the duration ladder', async ({ page }) => {
  await openMotionScreen(page);

  const caption = page.getByText(/tổng \d+ms/u);

  await expect(caption).toContainText('tổng 340ms');
  await expect(caption).toContainText('chồng 100ms');

  await page.getByRole('button', { name: 'đổi màn' }).click();
  await expect(caption).toContainText('tổng 260ms');
  await expect(caption).toContainText('chồng 40ms');

  await page.getByRole('button', { name: 'đổi tầng' }).click();
  await expect(caption).toContainText('tổng 180ms');
  await expect(caption).toContainText('chồng 60ms');
});

test('drops every duration to the instant slot when the machine is struggling', async ({
  page,
}) => {
  await openMotionScreen(page);

  const caption = page.getByText(/tổng \d+ms/u);
  await expect(caption).toContainText('tổng 340ms');

  await page.getByRole('button', { name: 'Giả lập máy yếu' }).click();

  await expect(page.getByText('12 khung hình/giây')).toBeVisible();
  await expect(caption).toContainText('tổng 120ms');

  // And the stagger stops entirely rather than merely shortening.
  await expect(page.getByText('trễ 24ms')).toHaveCount(0);
});

test('hands the screen over to the other scene', async ({ page }) => {
  await openMotionScreen(page);

  await expect(page.getByText('mặt bằng 2D')).toBeVisible();

  await page.getByRole('button', { name: 'Đổi cảnh' }).click();

  await expect(page.getByText('mô hình 3D')).toBeVisible();
  // The handover finishes and leaves exactly one scene on screen.
  await expect(page.getByText('đứng yên')).toBeVisible();
  await expect(page.getByText('mặt bằng 2D')).toHaveCount(0);
});

test('steps the list delays and stops the ramp before the ceiling', async ({ page }) => {
  await openMotionScreen(page);

  await page.getByRole('button', { name: '20 mục', exact: true }).click();

  await expect(page.getByText('trễ 0ms')).toBeVisible();
  await expect(page.getByText('trễ 24ms')).toBeVisible();

  // Eight rows are staggered; the remaining twelve share the final delay.
  await expect(page.getByText('trễ 168ms')).toHaveCount(13);
  await expect(page.getByText(/trễ 192ms/u)).toHaveCount(0);
});

test('shows an empty list rather than an empty box', async ({ page }) => {
  await openMotionScreen(page);

  // `exact` matters: Playwright matches accessible names by substring, so a
  // loose '0 mục' would also select the '20 mục' button.
  await page.getByRole('button', { name: '0 mục', exact: true }).click();

  await expect(page.getByText('Chưa có mục nào.')).toBeVisible();
});
