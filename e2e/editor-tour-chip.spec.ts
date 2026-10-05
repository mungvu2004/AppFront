/**
 * NO-208 — chip "xem hướng dẫn" ở lại suốt phiên sau "bỏ qua", nên nó không được
 * đè điều khiển nào của màn chủ. Mỗi màn: bỏ qua tour (nếu hiện), rồi điều khiển
 * quan trọng phải là thứ nhận chuột tại tâm của nó.
 *
 * Chưa có bài cho nút "xuất" của ExportPanel: dữ liệu mock hiện chỉ dựng trạng thái
 * "chưa có gì được duyệt để xuất", nên không có nút ấy để bấm. ExportPanel dùng góc
 * mặc định (trên phải); nút nằm ở chân panel nên không giao nhau.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openAndSkipTour(page: Page, path: string, height = 900): Promise<void> {
  await page.setViewportSize({ width: 1440, height });
  await page.goto(path);
  await page.getByRole('button', { name: 'bỏ qua', exact: true }).first().click({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'xem hướng dẫn' })).toBeVisible();
}

/** Tâm của phần tử có thật là thứ nhận chuột — không lớp nào đè lên. */
async function expectReachable(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box).not.toBeNull();

  const ok = await page.evaluate(
    ([sel, x, y]) => {
      const hit = document.elementFromPoint(Number(x), Number(y));
      return hit !== null && document.querySelector(String(sel))?.contains(hit) === true;
    },
    [selector, box!.x + box!.width / 2, box!.y + box!.height / 2],
  );

  expect(ok).toBe(true);
}

test('viewer: sau khi bỏ qua tour, "Góc nhìn sẵn" vẫn bấm được', async ({ page }) => {
  await openAndSkipTour(page, '/projects/P-01/3d');
  await expectReachable(page, '[aria-label="Góc nhìn sẵn"]');
});

test('duyệt lớp tường: sau khi bỏ qua tour, thanh trạng thái không bị đè', async ({ page }) => {
  await openAndSkipTour(page, '/projects/P-01/floors/F-01/layers/walls', 1200);
  await expectReachable(page, '[aria-label="Thanh trạng thái"] [aria-live="polite"]');
});
